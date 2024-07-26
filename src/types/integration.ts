export interface Inputs {
  urlEndpoint?: string;
  imagesPath: string | string[];
}

export interface NetlifyConfig {
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
}
export interface Constants {
  CONFIG_PATH?: string;
  PUBLISH_DIR: string;
  FUNCTIONS_SRC: string;
  FUNCTIONS_DIST: string;
  IS_LOCAL: boolean;
  NETLIFY_BUILD_VERSION: `${string}.${string}.${string}`;
  SITE_ID: string;
}

export interface Utils {
  build: {
    failBuild: (message: string) => void;
    failPlugin: (message: string) => void;
    cancelBuild: (message: string) => void;
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
}
export interface OnBuildParams {
  netlifyConfig: NetlifyConfig;
  constants: Constants;
  inputs: Inputs;
  utils: Utils;
}

export interface CustomError {
  imgSrc: string;
  message: string;
}

export interface Options {
  localDir: string;
  remoteHost: string;
  transformations: string;
  imagekitUrlEndpoint: string;
  pagePath: string;
}

export interface FindAssetsByPathArgument {
  baseDir: string;
  path: string | Array<string>;
}
export interface UpdateHtmlImagesToImagekit {
  html: string;
  errors: CustomError[];
}
