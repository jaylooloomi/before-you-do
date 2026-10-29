# Optional recording runtime

The application launches FFmpeg as a separate executable; it does not link or copy ShareX code.

- FFmpeg: https://ffmpeg.org/
- Build provider and build recipes: https://github.com/BtbN/FFmpeg-Builds
- Pinned build release: https://github.com/BtbN/FFmpeg-Builds/releases/tag/autobuild-2026-10-28-19-47
- Archive: ffmpeg-n8.1.3-25-g611cec792a-win64-lgpl-shared-8.1.zip
- SHA-256: 0448c3f3b9bdc724cc0189d5ce6e6bfa5b8937e7ec408e1e97fb08719bdb3b92
- Variant: LGPL shared, not GPL/nonfree. The original LICENSE.txt is preserved in the installed runtime directory; the app's MIT license does not replace FFmpeg's license.
- FFmpeg source revision: 611cec792a (n8.1.3-25); https://github.com/FFmpeg/FFmpeg/tree/611cec792a
- Build scripts, library dependencies and license details remain available in the provider repository and its release archive. No binary is checked into this repository.

The explicit Install recording component action downloads this pinned archive. It refuses a mismatching SHA-256 before executing any downloaded program. No startup download or PATH change occurs. Runtime location: `%LOCALAPPDATA%/before-you-do/recording-runtime/ffmpeg-8.1-0448c3f3/`.

Device documentation: https://ffmpeg.org/ffmpeg-devices.html#gdigrab
Codec documentation: https://ffmpeg.org/ffmpeg-codecs.html#libvpx

WebM uses libvpx; GIF uses FFmpeg's palette generation and GIF encoder. No microphone/system audio capture is enabled in this version.
