# Edge pilot operations runbook

## Start of shift

1. Verify `/ready` returns `ready` and database `ok`.
2. Open Cameras and test each USB device while stopped.
3. Confirm the correct zone and required helmet/vest rules.
4. Start cameras one at a time and verify online state and analyzed FPS.
5. Confirm SMTP delivery with a controlled violation if email is enabled.

## Incident response

- Camera offline: inspect `last_error`, verify device index and OS camera access, stop/start, then inspect backend logs.
- Low FPS: stop extra streams, check GPU memory/utilization, verify the SH17 model, and lower analyzed FPS only as a documented pilot deviation.
- Alert storm: stop the affected camera, review zone polygon and temporal settings, preserve relevant event IDs, and do not delete evidence manually.
- Incorrect event: resolve with a note and include it in the false-positive evaluation set.
- Suspected data exposure: stop camera processing, preserve audit/log evidence, restrict system access, and notify the named privacy contact.

## Backup and recovery

- Back up PostgreSQL and the uploads volume together so event rows and evidence remain consistent.
- Test restore before the pilot, then quarterly during commercialization.
- Evidence older than 30 days is automatically removed; metadata remains for the configured period.

## End of pilot

1. Export aggregate metrics and event review decisions.
2. Verify raw research data and application evidence against approved destruction dates.
3. Remove bootstrap credentials from `.env`.
4. Archive the model checkpoint, dataset manifest, code commit, configuration, and test report as one release record.
