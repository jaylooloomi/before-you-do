# Default-enabled sign-in startup (v0.4.7)

The release app enables startup when `autostart.json` has not yet been initialized. The marker records initialization, not a fake checkbox value; the checkbox continues reading the actual OS registration. Manual disabling writes the same marker, so later launches do not register startup again. Invalid preference files are preserved, and failed initialization does not create a success marker. Preference-write failures attempt OS rollback.

Preview, integration-test and debug/development startup paths do not automatically change the OS registration.

Verification:

- Native unit test: first initialization runs exactly once, recorded choices skip the callback, corrupt records remain untouched, failures remain retryable. Existing isolated OS registration roundtrip tests remain in place.
- 44 Node tests and 9 component tests passed. Both startup E2E cases passed, including four-language state, error recovery and manual-off persistence after refresh.
- The actual release executable was launched with the user's original files: it created the initialization marker, registered the correct quoted Windows executable plus `--autostart`, and displayed a checked native-backed checkbox. The original saved snippet/settings/backup files and all captured editor sessions were preserved; only the requested startup registration and new preference marker were added.

No actual sign-out/reboot or physical Mac login is claimed. Manual-off launch policy is covered by the native initialization test; browser refresh persistence is covered separately by E2E.
