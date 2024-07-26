import 'mocha';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import path from 'path';
import fg from 'fast-glob';
import fs from 'fs/promises';
import { onPostBuild } from '../src';
import { Constants, NetlifyConfig } from '../src/types/integration';
import { ERROR_IMAGEKIT_URL_ENDPOINT_REQUIRED, ERROR_INVALID_IMAGES_PATH, ERROR_NETLIFY_HOST_UNKNOWN } from '../src/data/error';

const mocksPath = path.join(__dirname, 'fixture/demoProject');
const pattern = `${mocksPath}/**/*.html`;

describe('End to End test for plugin', () => {
    const originalHtmlObject: {
        [key: string]: string;
    } = {}

    interface UtilsMock {
        build: {
            failBuild: SinonStub;
            failPlugin: SinonStub;
            cancelBuild: SinonStub;
        };
        status: {
            show: SinonStub;
        };
    }

    let utilsMock: UtilsMock;
    let dummyNetlifyConfig: NetlifyConfig

    const dummyConstants: Constants = {
        CONFIG_PATH: '/path/to/config',
        PUBLISH_DIR: mocksPath,
        FUNCTIONS_SRC: '/path/to/functions/src',
        FUNCTIONS_DIST: '/path/to/functions/dist',
        IS_LOCAL: true,
        NETLIFY_BUILD_VERSION: '1.0.0',
        SITE_ID: '12345',
    };

    before(async () => {
        try {
            const pages = await fg([pattern])
            const promises = pages.map(async (page) => {
                const sourceHtml = await fs.readFile(page, 'utf-8');
                originalHtmlObject[page] = sourceHtml;
            })

            await Promise.all(promises);
        } catch (err) {
            console.log(err)
        }
    });

    beforeEach(() => {
        process.env.IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/dummy_imagekit_id/dummy_origin_identifier';
        process.env.URL = 'https://dummy.netlify.app';
        utilsMock = {
            build: {
                failBuild: sinon.stub(),
                failPlugin: sinon.stub(),
                cancelBuild: sinon.stub(),
            },
            status: {
                show: sinon.stub(),
            },
        };

        dummyNetlifyConfig = {
            redirects: [],
            headers: [],
            functions: {
                directory: '/path/to/functions',
            },
            build: {
                command: 'npm run build',
                environment: {},
                edge_functions: '/path/to/edge/functions',
                processing: {},
            },
        };

    });

    afterEach(async () => {
        process.env.URL = '';
        const promises = Object.entries(originalHtmlObject).map(async ([page, sourceHtml]) => {
            await fs.writeFile(page, sourceHtml, 'utf-8');
        });

        await Promise.all(promises);
    });

    it('Positive test case handling all the scenerios : src, srcset, preload image tag and picture tag', async () => {
        await onPostBuild({
            constants: dummyConstants,
            inputs: {
                urlEndpoint: 'https://ik.imagekit.io/dummy_imagekit_id/dummy_origin_identifier',
                imagesPath: 'images',
            },
            utils: utilsMock,
            netlifyConfig: dummyNetlifyConfig,
        });

        const promises = Object.keys(originalHtmlObject).map(async (page) => {

            let modifiedHtml = await fs.readFile(page, 'utf-8');

            const fileName = path.basename(page);
            const expectedPagePath = path.join(__dirname, 'expected', fileName);

            const expectedHtml = await fs.readFile(expectedPagePath, 'utf-8');

            expect(modifiedHtml).to.be.a('string');
            expect(modifiedHtml).to.be.equal(expectedHtml);
        });

        await Promise.all(promises);

        expect(dummyNetlifyConfig).to.be.an('object');
        expect(dummyNetlifyConfig).to.eql({
            redirects: [
                {
                    from: '/imagekit-netlify-asset/images/*',
                    to: '/images/:splat',
                    status: 200,
                    force: true
                },
                {
                    from: '/images/*',
                    to: 'https://ik.imagekit.io/dummy_imagekit_id/dummy_origin_identifier/tr:f-auto/https://dummy.netlify.app/imagekit-netlify-asset/images/:splat',
                    status: 302,
                    force: true
                }
            ],
            headers: [],
            functions: { directory: '/path/to/functions' },
            build: {
                command: 'npm run build',
                environment: {},
                edge_functions: '/path/to/edge/functions',
                processing: {}
            }
        });
    });

    it('Success case when urlEndpoint is given invalid but it it picked from IMAGEKIT_URL_ENDPOINT env varibale', async () => {
        const urlString = 'invalid_url';
        await onPostBuild({
            constants: dummyConstants,
            inputs: {
                urlEndpoint: urlString,
                imagesPath: 'images',
            },
            utils: utilsMock,
            netlifyConfig: dummyNetlifyConfig,
        });

        expect(utilsMock.build.failBuild.called).to.be.false;

    });

    it('Success case when imagesPath is given as array', async () => {
        const urlString = 'invalid_url';
        await onPostBuild({
            constants: dummyConstants,
            inputs: {
                urlEndpoint: urlString,
                imagesPath: ['images', 'myImages'],
            },
            utils: utilsMock,
            netlifyConfig: dummyNetlifyConfig,
        });

        expect(dummyNetlifyConfig).to.be.eql({
            redirects: [
                {
                    from: '/imagekit-netlify-asset/myImages/*',
                    to: '/myImages/:splat',
                    status: 200,
                    force: true
                },
                {
                    from: '/myImages/*',
                    to: 'https://ik.imagekit.io/dummy_imagekit_id/dummy_origin_identifier/tr:f-auto/https://dummy.netlify.app/imagekit-netlify-asset/myImages/:splat',
                    status: 302,
                    force: true
                },
                {
                    from: '/imagekit-netlify-asset/images/*',
                    to: '/images/:splat',
                    status: 200,
                    force: true
                },
                {
                    from: '/images/*',
                    to: 'https://ik.imagekit.io/dummy_imagekit_id/dummy_origin_identifier/tr:f-auto/https://dummy.netlify.app/imagekit-netlify-asset/images/:splat',
                    status: 302,
                    force: true
                }
            ],
            headers: [],
            functions: { directory: '/path/to/functions' },
            build: {
                command: 'npm run build',
                environment: {},
                edge_functions: '/path/to/edge/functions',
                processing: {}
            }
        })

    });

    it('Error case when urlEndpoint is given empty string and IMAGEKIT_URL_ENDPOINT is also set to empty string ', async () => {
        process.env.IMAGEKIT_URL_ENDPOINT = '';

        const urlString = '';
        await onPostBuild({
            constants: dummyConstants,
            inputs: {
                urlEndpoint: urlString,
                imagesPath: 'images',
            },
            utils: utilsMock,
            netlifyConfig: dummyNetlifyConfig,
        });

        expect(utilsMock.build.failBuild.calledOnce).to.be.true;
        expect(utilsMock.build.failBuild.calledWith(ERROR_IMAGEKIT_URL_ENDPOINT_REQUIRED)).to.be.true;

    });

    it('Error case when urlEndpoint is given invalid string and IMAGEKIT_URL_ENDPOINT is also set to empty string ', async () => {
        process.env.IMAGEKIT_URL_ENDPOINT = '';

        const urlString = 'invalid url';
        await onPostBuild({
            constants: dummyConstants,
            inputs: {
                urlEndpoint: urlString,
                imagesPath: 'images',
            },
            utils: utilsMock,
            netlifyConfig: dummyNetlifyConfig,
        });

        expect(utilsMock.build.failBuild.calledOnce).to.be.true;
        expect(utilsMock.build.failBuild.calledWith(`Invalid URL endpoint. URL Endpoint: ${urlString}`)).to.be.true;

    });

    it('Error case when host is empty string', async () => {
        process.env.URL = '';

        await onPostBuild({
            constants: dummyConstants,
            inputs: {
                urlEndpoint: 'https://ik.imagekit.io/dummy_imagekit_id/dummy_origin_identifier',
                imagesPath: 'images',
            },
            utils: utilsMock,
            netlifyConfig: dummyNetlifyConfig,
        });

        expect(utilsMock.build.failBuild.calledOnce).to.be.true;
        expect(utilsMock.build.failBuild.calledWith(ERROR_NETLIFY_HOST_UNKNOWN)).to.be.true;

    });

    it('Error case when imagesPath provided contains no image', async () => {

        await onPostBuild({
            constants: dummyConstants,
            inputs: {
                urlEndpoint: 'https://ik.imagekit.io/dummy_imagekit_id/dummy_origin_identifier',
                imagesPath: 'invalid_images_path',
            },
            utils: utilsMock,
            netlifyConfig: dummyNetlifyConfig,
        });

        expect(utilsMock.build.failBuild.calledOnce).to.be.true;
        expect(utilsMock.build.failBuild.calledWith(ERROR_INVALID_IMAGES_PATH)).to.be.true;

    });

});

