import fs from 'fs/promises';
import path from 'path'
import fg from 'fast-glob'

import { Inputs } from './types/integration';
import { ERROR_IMAGEKIT_URL_ENDPOINT_REQUIRED, ERROR_INVALID_IMAGES_PATH, ERROR_NETLIFY_HOST_UNKNOWN } from './data/error';
import { CustomError, findAssetsByPath, getRedirectUrl, removeLeadingSlash, removeTrailingSlash, updateHtmlImagesToImagekit } from './utils';

type NetlifyConfig = {
  redirects: Array<{
    from: string;
    to?: string;
    status?: number;
    force?: boolean;
    signed?: string;
    query?: Partial<Record<string, string>>;
    headers?: Partial<Record<string, string>>;
    conditions?: Partial<
      Record<'Language' | 'Role' | 'Country' | 'Cookie', readonly string[]>
    >;
  }>;
  headers: Array<{
    for: string;
    values: unknown; // marked as unknown because is not required here.
  }>;
  functions: {
    directory: string;
  };
  build: {
    command: string;
    environment: Record<string, string>;
    edge_functions: string;
    processing: Record<string, unknown>;
  };
};
type Constants = {
  CONFIG_PATH?: string;
  PUBLISH_DIR: string;
  FUNCTIONS_SRC: string;
  FUNCTIONS_DIST: string;
  IS_LOCAL: boolean;
  NETLIFY_BUILD_VERSION: `${string}.${string}.${string}`;
  SITE_ID: string;
};



type Utils = {
  build: {
    failBuild: (message: string, { error }?: { error: Error }) => void;
    failPlugin: (message: string, { error }?: { error: Error }) => void;
    cancelBuild: (message: string, { error }?: { error: Error }) => void;
  };
  status: {
    show: ({
      title,
      summary,
      text,
    }: {
      title: string;
      summary: string;
      text: string;
    }) => void;
  };
};
type OnBuildParams = {
  netlifyConfig: NetlifyConfig;
  constants: Constants;
  inputs: Inputs;
  utils: Utils;
};
type OnPostBuildParams = Omit<OnBuildParams, 'netlifyConfig'>;




const globalErrors: {
  page: string
  errors: CustomError[] | string
}[] = [];

export async function onBuild({
  netlifyConfig,
  constants,
  inputs,
  utils,
}: OnBuildParams) {
  console.log('[Imagekit] Creating redirects...');

  let host = process.env.URL;

  if (process.env.CONTEXT === 'branch-deploy' || process.env.CONTEXT === 'deploy-preview') {
    host = process.env.DEPLOY_PRIME_URL || ''
  }

  console.log(`[Imagekit] Using host: ${host}`);

  const { PUBLISH_DIR } = constants;
  const PUBLIC_ASSET_PATH = "imagekit-netlify-asset"

  let {
    urlEndpoint,
    imagesPath
  } = inputs;

  let imagekitUrlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || urlEndpoint;


  if (!host) {
    console.error(`[Imagekit] ${ERROR_NETLIFY_HOST_UNKNOWN}`);
    utils.build.failBuild(ERROR_NETLIFY_HOST_UNKNOWN);
    return;
  }

  if (!imagesPath) {
    imagesPath = ["images"]
  }

  imagekitUrlEndpoint = removeTrailingSlash(imagekitUrlEndpoint);

  if (!imagekitUrlEndpoint || typeof imagekitUrlEndpoint !== 'string') {
    console.error(`[Imagekit] ${ERROR_IMAGEKIT_URL_ENDPOINT_REQUIRED}`);
    utils.build.failBuild(ERROR_IMAGEKIT_URL_ENDPOINT_REQUIRED);
    return;
  }
  const transformations = "tr:f-auto"

  const imagesFiles = findAssetsByPath({
    baseDir: PUBLISH_DIR,
    path: imagesPath,
  });

  if (imagesFiles.length === 0) {
    console.log(
      `[Imagekit] No files found at imagesPath, Please update it.`,
    );
    utils.build.failBuild(ERROR_INVALID_IMAGES_PATH);
    return;
  }
  if (!Array.isArray(imagesPath) && typeof imagesPath !== 'string') return;

  if (!Array.isArray(imagesPath)) {
    imagesPath = [imagesPath];
  }

  imagesPath.forEach(mediaPath => {
    mediaPath = removeLeadingSlash(mediaPath)
    mediaPath = removeTrailingSlash(mediaPath)
    mediaPath = mediaPath.split(path.win32.sep).join(path.posix.sep);
    const imagekitFakeAssetPath = `/${path.posix.join(PUBLIC_ASSET_PATH, mediaPath)}`;

    try {

      netlifyConfig.redirects.unshift({
        from: `${imagekitFakeAssetPath}/*`,
        to: `/${mediaPath}/:splat`,
        status: 200,
        force: true,
      });

      netlifyConfig.redirects.unshift({
        from: `/${mediaPath}/*`,
        to: getRedirectUrl({ imagekitUrlEndpoint: imagekitUrlEndpoint as string, imagekitFakeAssetPath, transformations, remoteHost: host as string }),
        status: 302,
        force: true,
      });
    } catch (error) {
      console.log("Error during rewrite", error)
      globalErrors.push({
        page: mediaPath,
        errors: `Error in rewrite`
      })
    }
  })
}

export const onPostBuild = async function ({
  constants,
  inputs,
  utils,
}: OnPostBuildParams) {

  let host: string = process.env.URL || '';

  if (process.env.CONTEXT === 'branch-deploy' || process.env.CONTEXT === 'deploy-preview') {
    host = process.env.DEPLOY_PRIME_URL || ''
  }

  if (!host) {
    console.error(`[Imagekit] ${ERROR_NETLIFY_HOST_UNKNOWN}`);
    utils.build.failBuild(ERROR_NETLIFY_HOST_UNKNOWN);
    return;
  }

  const { PUBLISH_DIR } = constants;
  const {
    urlEndpoint,
    imagesPath
  }: Inputs = inputs;

  let imagekitUrlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || urlEndpoint;


  imagekitUrlEndpoint = removeTrailingSlash(imagekitUrlEndpoint);

  if (!imagekitUrlEndpoint || typeof imagekitUrlEndpoint !== 'string') {
    console.error(`[Imagekit] ${ERROR_IMAGEKIT_URL_ENDPOINT_REQUIRED}`);
    utils.build.failBuild(ERROR_IMAGEKIT_URL_ENDPOINT_REQUIRED);
    return;
  }


  const transformations = "tr:f-auto";

  // Find all HTML source files in the publish directory
  let pages: string[] = []
  const pattern = `${PUBLISH_DIR}/**/*.html`
  try {
    pages = await fg([pattern]);
  } catch (err) {
    console.error('Error finding HTML files:', err);
  }

  const results = await Promise.all(
    pages.map(async page => {
      const sourceHtml = await fs.readFile(page, 'utf-8');

      const { html, errors } = await updateHtmlImagesToImagekit(sourceHtml, {
        imagekitUrlEndpoint: imagekitUrlEndpoint as string,
        pagePath: page,
        localDir: PUBLISH_DIR,
        remoteHost: host,
        transformations
      });

      await fs.writeFile(page, html);

      return {
        page,
        errors,
      };
    }),
  );

  const errors = results.filter(({ errors }) => errors.length > 0);
  globalErrors.push(...errors)

}

export const onEnd = function ({ utils }: { utils: Utils }) {
  const summary = globalErrors.length > 0 ? `Imagekit build plugin completed with ${globalErrors.length} errors` : "Imagekit build plugin completed successfully"
  const text = globalErrors.length > 0 ? `The build process found ${globalErrors.length} errors. Check build logs for more information` : "No errors found during build"
  utils.status.show({
    title: "[Imagekit] Done.",
    // Required.
    summary,
    text
  });
}
