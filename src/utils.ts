import path from 'path'
import { JSDOM } from 'jsdom'
import fg from 'fast-glob'


export type CustomError = {
    imgSrc: string
    message: string
}

type Options = {
    localDir: string;
    remoteHost: string;
    transformations: string;
    imagekitUrlEndpoint: string;
    pagePath: string;
};

interface FindAssetsByPath {
    baseDir: string;
    path: string | Array<string>;
}


function isReomteUrl(url: string) {
    return url.startsWith('http') || url.startsWith('//');
}


function getImagekitUrl({
    imgSrc,
    pageDirectory,
    localDir,
    imagekitUrlEndpoint,
    transformations,
    remoteHost }: {
        imgSrc: string
        pageDirectory: string
        localDir: string
        imagekitUrlEndpoint: string
        transformations: string
        remoteHost: string
    }) {
    if (!isReomteUrl(imgSrc)) {
        imgSrc = removeLeadingSlash(imgSrc)

        const resultPath = path.resolve(pageDirectory, imgSrc);
        let finalPath = path.relative(localDir, resultPath);
        finalPath = finalPath.split(path.win32.sep).join(path.posix.sep);

        return `${imagekitUrlEndpoint}/${transformations}/${remoteHost}/${finalPath}`
    }
    return `${imagekitUrlEndpoint}/${transformations}/${imgSrc}`
}

export async function updateHtmlImagesToImagekit(html: string, options: Options) {
    const {
        localDir,
        transformations,
        pagePath,
    } = options

    let { imagekitUrlEndpoint,
        remoteHost,
    } = options;

    const errorss: {
        imgSrc: string
        message: string
    }[] = []
    const dom = new JSDOM(html)

    const images: HTMLImageElement[] = Array.from(dom.window.document.querySelectorAll('img'))
    const pageDirectory = path.dirname(pagePath);

    for (const $img of images) {
        const imgSrc = $img.getAttribute('src') as string

        if (!imgSrc) {
            continue
        }

        imagekitUrlEndpoint = removeTrailingSlash(imagekitUrlEndpoint);
        remoteHost = removeTrailingSlash(remoteHost);

        const finaUrl = getImagekitUrl({ imgSrc, pageDirectory, localDir, imagekitUrlEndpoint, transformations, remoteHost })

        $img.setAttribute('src', finaUrl)

        const srcset = $img.getAttribute('srcset')

        if (srcset) {

            const srcsetUrls = srcset.split(',').map(url => url.trim().split(' '))

            const srcsetUrlsModified = srcsetUrls.map(url => {
                const src = url[0]
                const size = url[1]

                if (!src) {
                    return size;
                }

                const finaUrl = getImagekitUrl({ imgSrc: src, pageDirectory, localDir, imagekitUrlEndpoint, transformations, remoteHost })

                return `${finaUrl} ${size}`
            })

            const srcsetUrlsImagekitString = srcsetUrlsModified.join(', ')

            $img.setAttribute('srcset', srcsetUrlsImagekitString)
        }

        // Look for any preload tags that reference the image URLs. A specific use case here
        // is Next.js App Router hen using the Image component.

        const $preload = dom.window.document.querySelector(
            `link[rel="preload"][as="image"][href="${imgSrc}"]`,
        )
        if ($preload) {
            const imagekitUrl = getImagekitUrl({ imgSrc, pageDirectory, localDir, imagekitUrlEndpoint, transformations, remoteHost })
            $preload.setAttribute('href', imagekitUrl)
        }
    }

    return {
        html: dom.serialize(),
        errors: errorss,
    }
}

export function getRedirectUrl({ imagekitUrlEndpoint, imagekitFakeAssetPath, transformations, remoteHost }: {
    imagekitUrlEndpoint: string
    imagekitFakeAssetPath: string
    transformations: string
    remoteHost: string
}) {
    return `${imagekitUrlEndpoint}/${transformations}/${remoteHost}${imagekitFakeAssetPath}/:splat`
}

export function findAssetsByPath(options: FindAssetsByPath) {
    if (!Array.isArray(options.path)) {
        options.path = [options.path];
    }

    return options.path.flatMap(assetsPath => {
        const pattern = `${options.baseDir}/${assetsPath}/**/*`
        const pages = fg.sync(pattern);

        return pages.filter(file => !!path.extname(file));
    })
}


export function removeTrailingSlash(path: string) {
    return path.replace(/\/$/, '');
}

export function removeLeadingSlash(path: string) {
    path = path.replace(/^\//, '');
    path = path.replace(/^\\/, '')
    return path;
}
