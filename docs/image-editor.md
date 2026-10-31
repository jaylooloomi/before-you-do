# Screenshot annotation and redaction

In Materials, select a static image and choose **Annotate / redact** (標註／遮蔽). Drag to create opaque black redactions, arrows, or boxes. Undo and Clear apply to the current editing session. Cancel/Escape discards edits. Save and replace permanently flattens edits into PNG pixels and replaces this material; reopening starts from the processed image with no source layer or undo history.

The app removes its OS-opening cache for the edited material. Future previews, external opening, and exports read the replacement asset. Original imported files outside the app and existing exports are unchanged; the editor states this before saving. This is not a secure disk erasure feature. Animated GIFs are excluded to avoid silently dropping frames. Editing is limited to 32 megapixels and a 25 MB output.

Validation: Node tests, Rust materials tests (including actual export/open cache bytes), and Playwright editor/integration tests. Synthetic demo: `artifacts/image-editor-demo.png`. Native installed-app interaction was not performed; no installed binary, user material session, release, or deployment was changed.
