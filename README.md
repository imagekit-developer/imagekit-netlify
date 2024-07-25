# Imagekit Netlify plugin

The plugin seamlessly integrates with your Netlify site, delivering high-quality optimized images with the help of [Imagekit](https://imagekit.io/).

- [Imagekit side setup](#imagekit-side-setup)
- [Integrating the Imagekit plugin](#integrating-the-imagekit-plugin)
- [Working](#working)
- [Limitations](#limitations)

## Imagekit side setup

Before starting, the user needs to have an ImageKit account to use the plugin. They must set up a URL endpoint pointing to a web proxy origin as mentioned below.

- The user needs to add web proxy origin by following [these steps](https://imagekit.io/docs/integration/web-proxy).

- Add the above web proxy origin as the URL endpoint by following [these steps](https://imagekit.io/docs/integration/connect-external-storage#creating-a-new-url-endpoint).

After following the above steps, the user will get the Imagekit URL endpoint.

```
https://ik.imagekit.io/{imagekit_id}/{origin_identifier}
```

## Integrating the Imagekit plugin

Currently users can use plugin with the help of [file-based installation](https://docs.netlify.com/integrations/build-plugins/#file-based-installation).

### File-based installation

#### Add the plugin to your Netlify configuration file `netlify.toml`:

```toml
[[plugins]]
  package = "netlify-plugin-imagekit"
```

#### Add the Imagekit URL endpoint:

```toml
[[plugins]]
  package = "netlify-plugin-imagekit"

  [plugins.inputs]
  urlEndpoint = "https://ik.imagekit.io/{imagekit_id}/{origin_identifier}"
```

<br>

> **Note:**
> We can also set IMAGEKIT_URL_ENDPOINT env variable as an alternative to providing urlEndpoint in a plugin input. 
The environment variable can be set in multiple ways through [Netlify UI, Netlify API, or Netlify CLI](https://docs.netlify.com/environment-variables/get-started/#create-variables-with-the-netlify-ui-cli-or-api). The user can also pass environment variable through  [Netlify configuration file](https://docs.netlify.com/environment-variables/get-started/#create-variables-with-a-netlify-configuration-file) `netlify.toml`.


#### Optionally adding `imagesPath`:

```toml
 [[plugins]]
  package = "netlify-plugin-imagekit"

  [plugins.inputs]
  urlEndpoint = "https://ik.imagekit.io/a1yisxurxo/proxy"
  imagesPath = ["/my-image-path","my-image-path-two"] // default value is set to "images"
```

 It represents the path where images are stored that the user wants to be served through the Imagekit server with respect to the [publish directory](https://docs.netlify.com/configure-builds/overview/#set-the-publish-directory). If images are stored in multiple directories, the user can provide array to `imagesPath`, and all such images would be redirected to Imagekit. If no value is mentioned then by default value is set to `images`.

 > **Publish Directory:**
 >When deploying a front-end project on Netlify, the deployment is done after running the build command, which generates a folder containing the build output. The name of this folder can vary depending on the framework being used. For example, in a `React` project, the folder might be named `build` or `dist`. This folder's path must be specified as the publish directory in Netlify.
 >
 >You can find a list of build commands and publish directories for various frameworks on Netlify [here](https://docs.netlify.com/frameworks/).

 <br>

 In the last user also needs to add `netlify-plugin-imagekit` as a dev dependency as mentioned [here](https://docs.netlify.com/integrations/build-plugins/#add-dependency).

```
// using npm
npm install -D netlify-plugin-imagekit

// using yarn 
yarn add --dev netlify-plugin-imagekit
```

## Working
After following above steps, the Imagekit plugin will work out of the box. Internally it uses the below mechanism to deliver highly optimize image. 

### 1. Modify URLs in production ready HTML files
This is useful in scenarios where proper HTML files are generated after the build process. For these frameworks, the plugin taps into the `onPostBuild` hook, using `jsdom` to create a node-based representation of the DOM for each output HTML file. It then walks through each node, and upon finding an img or picture tag, it replaces the `src` or `srcset` path with an ImageKit URL.

While this approach works well for many situations, especially during the initial page load, it fails when using a framework with client-side routing or features that alter the DOM, or that does not generate HTML files on build, such as `React`. This necessitates the use of the mechanism described below.

### 2. Redirect assets through the Imagekit Server

In this method, the user specifies all the paths where their assets are stored relative to the publish directory as `imagesPath`. Then, using the redirect feature of [Netlify Redirects and rewrites](https://docs.netlify.com/routing/redirects/), we redirect the existing image URLs from the Netlify server to the ImageKit server. The ImageKit server fetches the original image, optimizes it, and then serves it back to the end user.

## Limitations

- When a user uses external or third-party URLs instead of static assets in frameworks like `React` that do not generate HTML files after the build process or mutate the DOM on the client side, these URLs will not be replaced by ImageKit URLs.

- Another limitation is that when base64 URLs are used for images, no separate request is made to the backend to fetch the images. As a result, these images cannot be replaced.