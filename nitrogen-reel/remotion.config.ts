import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
Config.setOverwriteOutput(true);
Config.setConcurrency(Number(process.env.REMOTION_CONCURRENCY) || null);

// Set REMOTION_BROWSER to use a Chrome you already have instead of Remotion's download.
if (process.env.REMOTION_BROWSER) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
}
