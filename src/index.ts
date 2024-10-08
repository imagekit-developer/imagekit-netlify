import fs from 'fs/promises';
import path from 'path';
import fg from 'fast-glob';

import { CustomError, Inputs, OnBuildParams, Utils } from './types/integration';
import { ERROR_INVALID_IMAGES_PATH } from './data/error';
import {
  findAssetsByPath,
  getRedirectUrl,
  hostNotFoundError,
  invalidImagekitUrlEndpoint,
  isValidURL,
  removeLeadingSlash,
  removeTrailingSlash,
  updateHtmlImagesToImagekit,
} from './utils';

import Logger from './utils/logger';

const globalErrors: {
  page: string;
  errors: CustomError[] | string;
}[] = [];

export const onPostBuild = async function ({
  constants,
  inputs,
  utils,
  netlifyConfig,
}: OnBuildParams): Promise<void> {
  let host: string = process.env.URL || '';

  if (
    process.env.CONTEXT === 'branch-deploy' ||
    process.env.CONTEXT === 'deploy-preview'
  ) {
    host = process.env.DEPLOY_PRIME_URL || '';
  }

  if (!host) {
    return hostNotFoundError(utils);
  }

  const { PUBLISH_DIR } = constants;
  const PUBLIC_ASSET_PATH = 'imagekit-netlify-asset';
  const { urlEndpoint }: Inputs = inputs;
  let { imagesPath }: Inputs = inputs;

  const imagekitUrlEndpoint = removeTrailingSlash(
    process.env.IMAGEKIT_URL_ENDPOINT || urlEndpoint
  );

  if (!isValidURL(imagekitUrlEndpoint)) {
    return invalidImagekitUrlEndpoint(utils, imagekitUrlEndpoint);
  }

  const transformations = 'tr:f-auto';

  if (!imagesPath || (Array.isArray(imagesPath) && imagesPath.length === 0)) {
    imagesPath = ['images'];
  }

  if (typeof imagesPath === 'string') {
    imagesPath = [imagesPath];
  }

  if (Array.isArray(imagesPath) && imagesPath.length > 0) {
    imagesPath = imagesPath.filter((path) => typeof path === 'string');

    const imagesFiles = findAssetsByPath({
      baseDir: PUBLISH_DIR,
      path: imagesPath,
    });

    if (imagesFiles.length === 0) {
      Logger.error(
        `No files found at imagesPath: ${imagesPath}, Please update it.`
      );
      utils.build.failBuild(ERROR_INVALID_IMAGES_PATH);
      return;
    }

    imagesPath.forEach((mediaPath) => {
      mediaPath = mediaPath
        .replace(/^\\\\\?\\/, '')
        .replace(/\\/g, '/')
        .replace(/\/\/+/g, '/');
      mediaPath = removeLeadingSlash(mediaPath);
      mediaPath = removeTrailingSlash(mediaPath);

      const imagekitFakeAssetPath = `/${path.posix.join(
        PUBLIC_ASSET_PATH,
        mediaPath
      )}`;

      /*
      First request is redirected to the imagekit server with a fake path using 302 status code.
      Then that fake path is fetched by Imagekit server which hits the netlify server to fetch the asset.
      Here netlify, return the actual asset as that fake path is rewritten with 200 status code.
      */
      try {
        netlifyConfig.redirects.unshift(
          {
            from: `${imagekitFakeAssetPath}/*`,
            to: `/${mediaPath}/:splat`,
            status: 200,
            force: true,
          },
          {
            from: `/${mediaPath}/*`,
            to: getRedirectUrl({
              imagekitUrlEndpoint: imagekitUrlEndpoint,
              imagekitFakeAssetPath,
              transformations,
              remoteHost: host,
            }),
            status: 302,
            force: true,
          }
        );
      } catch (error) {
        Logger.error(`Error during rewrite', error: ${error}`);
        globalErrors.push({
          page: mediaPath,
          errors: `Error in rewrite`,
        });
      }
    });
  }

  // Find all HTML source files in the publish directory
  let pages: string[] = [];
  const pattern = `${PUBLISH_DIR}/**/*.html`;
  try {
    pages = await fg([pattern]);
  } catch (err) {
    Logger.error(`Error finding HTML files, error:${err}`);
  }

  const results = await Promise.all(
    pages.map(async (page) => {
      const sourceHtml = await fs.readFile(page, 'utf-8');

      const { html, errors } = await updateHtmlImagesToImagekit(sourceHtml, {
        imagekitUrlEndpoint: imagekitUrlEndpoint as string,
        pagePath: page,
        localDir: PUBLISH_DIR,
        remoteHost: host,
        transformations,
      });

      await fs.writeFile(page, html);

      return {
        page,
        errors,
      };
    })
  );

  const errors = results.filter(({ errors }) => errors.length > 0);
  globalErrors.push(...errors);
};

export const onEnd = function ({ utils }: { utils: Utils }): void {
  const summary =
    globalErrors.length > 0
      ? `Imagekit build plugin completed with ${globalErrors.length} errors`
      : 'Imagekit build plugin completed successfully';
  const text =
    globalErrors.length > 0
      ? `Imagekit build process found ${globalErrors.length} errors. Check build logs for more information`
      : 'No errors occurred during Imagekit build process';
  utils.status.show({
    title: '[Imagekit] Done.',
    // Required.
    summary,
    text,
  });
};
