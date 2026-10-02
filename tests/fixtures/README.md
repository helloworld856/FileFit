# HEIC regression fixture

`libheif-example.heic` is the unmodified `examples/example.heic` from [strukturag/libheif](https://github.com/strukturag/libheif/blob/2f642b11f9e2d5df189cdba86208bde4bbe08618/examples/example.heic), revision `2f642b11f9e2d5df189cdba86208bde4bbe08618`.

SHA-256: `7f8b363e4936c0666a25f64f3a92fda10bd8e5453be4592530b65a55dd98f3f2`.

The upstream examples directory carries the MIT notice reproduced in `COPYING.libheif-examples`. This fixture is used only for tests and is not bundled into the application.

The original contains two display images and two thumbnails. Rejection tests use it unchanged. Success tests use `tests/heic-fixture.ts` to set the secondary image's hidden flag in a copy of its metadata; all encoded pixels and thumbnail references remain unchanged. This deliberately modified variant contains one visible display image.
