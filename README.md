[<img width="250" alt="ImageKit.io" src="https://raw.githubusercontent.com/imagekit-developer/imagekit-javascript/master/assets/imagekit-light-logo.svg"/>](https://imagekit.io)

# ImageKit Netlify plugin

[![Node CI](https://github.com/imagekit-developer/imagekit-next/workflows/Node%20CI/badge.svg)](https://github.com/imagekit-developer/imagekit-netlify/)
[![npm version](https://img.shields.io/npm/v/imagekit-next)](https://www.npmjs.com/package/imagekit-netlify)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Twitter Follow](https://img.shields.io/twitter/follow/imagekitio?label=Follow&style=social)](https://twitter.com/ImagekitIo)

The plugin seamlessly integrates with your Netlify site, delivering high-quality optimized images using [ImageKit](https://imagekit.io/).

- [Prerequisites](#prerequisites)
- [Setup ImageKit Netlify plugin](#setup-imagekit-netlify-plugin)
- [Limitations](#limitations)
- [Support](#support)
- [Links](#links)
- [License](#license)


## Prerequisites

Before starting, you need an ImageKit account to use the plugin. Then, you must set up a URL endpoint pointing to a web proxy origin, as described below.

- Add web proxy origin by following [these steps](https://imagekit.io/docs/integration/web-proxy).

- Add the above web proxy origin as the URL endpoint by following [these steps](https://imagekit.io/docs/integration/connect-external-storage#creating-a-new-url-endpoint).

After following the above steps, you will have the ImageKit URL endpoint.

```
https://ik.imagekit.io/{imagekit_id}/{origin_identifier}
```

## Setup ImageKit Netlify plugin

Currently, you can integrate the plugin with the help of [file-based installation](https://docs.netlify.com/integrations/build-plugins/#file-based-installation).

### File-based installation

#### Add the plugin to your Netlify configuration file `netlify.toml`:

```toml
[[plugins]]
  package = "netlify-plugin-imagekit"
```

#### Add the ImageKit URL endpoint:

```toml
[[plugins]]
  package = "netlify-plugin-imagekit"

  [plugins.inputs]
  urlEndpoint = "https://ik.imagekit.io/{imagekit_id}/{origin_identifier}"
```

<br>

> **Note:**
> You can also set `IMAGEKIT_URL_ENDPOINT` env variable as an alternative to providing urlEndpoint in a plugin input.
The environment variable can be set in multiple ways through [Netlify UI, Netlify API, or Netlify CLI](https://docs.netlify.com/environment-variables/get-started/#create-variables-with-the-netlify-ui-cli-or-api). You can also pass environment variable through [Netlify configuration file](https://docs.netlify.com/environment-variables/get-started/#create-variables-with-a-netlify-configuration-file) `netlify.toml`.

#### Optionally adding `imagesPath`:

```toml
 [[plugins]]
  package = "netlify-plugin-imagekit"

  [plugins.inputs]
  urlEndpoint = "https://ik.imagekit.io/{imagekit_id}/{origin_identifier}"
  imagesPath = ["/my-image-path","my-image-path-two"] // default value is set to "images"
```

 It specifies the paths, relative to the [publish directory](https://docs.netlify.com/configure-builds/overview/#set-the-publish-directory), where images are stored and should be served through the ImageKit server. If images are stored in multiple directories, you can provide an array to `imagesPath`, and all such images will be redirected to ImageKit. If no value is provided, the default value is set to images.

 > **Publish Directory:**
 >When deploying a front-end project on Netlify, the deployment is done after running the build command, which generates a folder containing the build output. The name of this folder can vary depending on the framework being used. For example, the folder might be named `build` or `dist` in a `React` project. This folder's path must be specified as the publish directory in Netlify.
 >
 >Find a comprehensive list of build commands and publish directories for various frameworks on Netlify [here](https://docs.netlify.com/frameworks/).

 <br>

 Lastly, add `netlify-plugin-imagekit` as a dev dependency as mentioned [here](https://docs.netlify.com/integrations/build-plugins/#add-dependency).

```
// using npm
npm install -D netlify-plugin-imagekit

// using yarn 
yarn add --dev netlify-plugin-imagekit
```

After following the above steps, the ImageKit plugin will work out of the box. Internally, it uses the mechanism described [here](https://imagekit.io/docs/integration/netlify#how-does-it-work) to deliver highly optimized images.

## Limitations

- When external or third-party URLs are used instead of static assets in frameworks like `React` that do not generate HTML files after the build process or mutate the DOM on the client side, these URLs will not be replaced by ImageKit URLs. To address this issue, you can use the ImageKit client-side SDK, [imagekit-react](https://github.com/imagekit-developer/imagekit-react?tab=readme-ov-file#quick-examples) to serve third-party URLs through the ImageKit server.

- Another limitation is that when base64 URLs are used for images, no separate request is made to the backend to fetch the images. As a result, these images cannot be replaced.

## Support

For any feedback or to report any issues or general implementation support, please reach out to [support@imagekit.io](mailto:support@imagekit.io)

## Links
* [Documentation](https://imagekit.io/docs/integration/netlify)
* [Main website](https://imagekit.io)

## License
Released under the MIT license.