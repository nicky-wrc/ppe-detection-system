# Data and privacy approval gate

Factory collection must not begin until every required item is signed by the data controller or delegated owner.

## Approval record

- [ ] Named data controller, project owner, safety owner, and technical custodian
- [ ] Written purpose: PPE safety research and pilot validation only
- [ ] Approved cameras, zones, dates, shifts, and collection duration
- [ ] Approved uses: model development, internal demonstration, thesis metrics, publication figures
- [ ] Explicit statement whether raw images may appear in the thesis or publication
- [ ] Employee/visitor privacy notice and visible camera signage reviewed
- [ ] Lawful basis and necessity/proportionality reviewed by the organization
- [ ] No face recognition, identity matching, attendance, or disciplinary automation
- [ ] Access list limited to named team members using individual accounts
- [ ] Encrypted transfer and storage location documented
- [ ] Raw-data deletion date and trained-model retention decision documented
- [ ] Incident contact and procedure for lost or improperly disclosed data
- [ ] Process for a person to raise a concern or request review

## Technical controls

- Keep private data outside Git, cloud drives without approval, and public experiment trackers.
- Persist only blurred event evidence in the application; do not retain continuous camera footage.
- Use camera/day-separated train, validation, and test splits.
- Publish aggregate metrics. Use public or staged images for illustrations unless factory publication is explicitly approved.
- Record dataset version, permitted users, hashes, label schema, and destruction date in a private dataset manifest.

If approval is not complete by the end of project week 2, use public SH17 data and a staged USB-camera environment. Describe results as a laboratory pilot, not a factory field trial.
