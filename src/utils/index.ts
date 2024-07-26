import path from 'path';
import { JSDOM } from 'jsdom';
import fg from 'fast-glob';
import {
  ERROR_IMAGEKIT_URL_ENDPOINT_REQUIRED,
  ERROR_NETLIFY_HOST_UNKNOWN,
} from '../data/error';
import Logger from './logger';
import {
  CustomError,
  FindAssetsByPathArgument,
  Options,
  UpdateHtmlImagesToImagekit,
  Utils,
} from '../types/integration';

function isRemoteUrl(url: string) {
  return url.startsWith('http') || url.startsWith('//');
}

function getImagekitUrl({
  imgSrc,
  pageDirectory,
  localDir,
  imagekitUrlEndpoint,
  transformations,
  remoteHost,
}: {
  imgSrc: string;
  pageDirectory: string;
  localDir: string;
  imagekitUrlEndpoint: string;
  transformations: string;
  remoteHost: string;
}) {
  if (!isRemoteUrl(imgSrc)) {
    imgSrc = imgSrc
      .replace(/^\\\\\?\\/, '')
      .replace(/\\/g, '/')
      .replace(/\/\/+/g, '/');

    imgSrc = removeLeadingSlash(imgSrc);

    const resultPath = path.resolve(pageDirectory, imgSrc);
    let finalPath = path.relative(localDir, resultPath);
    finalPath = finalPath
      .replace(/^\\\\\?\\/, '')
      .replace(/\\/g, '/')
      .replace(/\/\/+/g, '/');

    return `${imagekitUrlEndpoint}/${transformations}/${remoteHost}/${finalPath}`;
  }
  return `${imagekitUrlEndpoint}/${transformations}/${imgSrc}`;
}

export async function updateHtmlImagesToImagekit(
  html: string,
  options: Options
): Promise<UpdateHtmlImagesToImagekit> {
  const { localDir, transformations, pagePath } = options;

  let { imagekitUrlEndpoint, remoteHost } = options;

  const errors: CustomError[] = [];
  const dom = new JSDOM(html);

  const images: HTMLImageElement[] = Array.from(
    dom.window.document.querySelectorAll('img')
  );

  const sourceTags: HTMLSourceElement[] = Array.from(
    dom.window.document.querySelectorAll('picture source')
  );
  const pageDirectory = path.dirname(pagePath);
  remoteHost = removeTrailingSlash(remoteHost);

  for (const $img of images) {
    const imgSrc = $img.getAttribute('src') as string;

    if (!imgSrc) {
      continue;
    }

    imagekitUrlEndpoint = removeTrailingSlash(imagekitUrlEndpoint);

    const finalUrl = getImagekitUrl({
      imgSrc,
      pageDirectory,
      localDir,
      imagekitUrlEndpoint,
      transformations,
      remoteHost,
    });

    $img.setAttribute('src', finalUrl);

    const srcset = $img.getAttribute('srcset');

    if (srcset) {
      const srcsetUrls = srcset.split(',').map((url) => url.trim().split(' '));

      const srcsetUrlsModified = srcsetUrls.map((url) => {
        const src = url[0];
        const size = url[1];

        if (!src) {
          return size;
        }

        const finalUrl = getImagekitUrl({
          imgSrc: src,
          pageDirectory,
          localDir,
          imagekitUrlEndpoint,
          transformations,
          remoteHost,
        });

        return `${finalUrl} ${size}`;
      });

      const srcsetUrlsImagekitString = srcsetUrlsModified.join(', ');

      $img.setAttribute('srcset', srcsetUrlsImagekitString);
    }
    // Look for any preload tags that reference the image URLs. A specific use case here
    // is Next.js App Router using the Image component.
    const $preload = dom.window.document.querySelector(
      `link[rel="preload"][as="image"][href="${imgSrc}"]`
    );
    if ($preload) {
      const imagekitUrl = getImagekitUrl({
        imgSrc,
        pageDirectory,
        localDir,
        imagekitUrlEndpoint,
        transformations,
        remoteHost,
      });
      $preload.setAttribute('href', imagekitUrl);
    }
  }

  for (const $source of sourceTags) {
    const srcset = $source.getAttribute('srcset') as string;
    if (!srcset) {
      continue;
    }

    const finalUrl = getImagekitUrl({
      imgSrc: srcset,
      pageDirectory,
      localDir,
      imagekitUrlEndpoint,
      transformations,
      remoteHost,
    });

    $source.setAttribute('srcset', finalUrl);
  }

  return {
    html: dom.serialize(),
    errors: errors,
  };
}

export function getRedirectUrl({
  imagekitUrlEndpoint,
  imagekitFakeAssetPath,
  transformations,
  remoteHost,
}: {
  imagekitUrlEndpoint: string;
  imagekitFakeAssetPath: string;
  transformations: string;
  remoteHost: string;
}): string {
  return `${imagekitUrlEndpoint}/${transformations}/${remoteHost}${imagekitFakeAssetPath}/:splat`;
}

export function findAssetsByPath(options: FindAssetsByPathArgument): string[] {
  if (!Array.isArray(options.path)) {
    options.path = [options.path];
  }

  return options.path.flatMap((assetsPath) => {
    const pattern = `${options.baseDir}/${assetsPath}/**/*`;
    const pages = fg.sync(pattern);

    return pages.filter((file) => path.extname(file));
  });
}

export function hostNotFoundError(utils: Utils): void {
  Logger.error(ERROR_NETLIFY_HOST_UNKNOWN);
  utils.build.failBuild(ERROR_NETLIFY_HOST_UNKNOWN);
}

export function invalidImagekitUrlEndpoint(
  utils: Utils,
  urlString: string
): void {
  Logger.error(
    urlString
      ? `Invalid URL endpoint. URL Endpoint: ${urlString}`
      : ERROR_IMAGEKIT_URL_ENDPOINT_REQUIRED
  );
  utils.build.failBuild(
    urlString
      ? `Invalid URL endpoint. URL Endpoint: ${urlString}`
      : ERROR_IMAGEKIT_URL_ENDPOINT_REQUIRED
  );
}

export function removeTrailingSlash(path: string | undefined): string {
  if (typeof path !== 'string') {
    return '';
  }

  path = path.replace(/\/$/, '');
  path = path.replace(/\\$/, '');
  return path;
}

export function removeLeadingSlash(path: string | undefined): string {
  if (typeof path !== 'string') {
    return '';
  }
  path = path.replace(/^\//, '');
  path = path.replace(/^\\/, '');
  return path;
}

export function isValidURL(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch (e) {
    return false;
  }
}
