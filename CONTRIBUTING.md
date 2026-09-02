# Contributing

Watch Together is protocol-first. Changes must preserve provider neutrality,
content blindness, deterministic convergence, and transport independence.

Before proposing a protocol change:

1. describe the interoperability problem;
2. identify affected state-machine transitions and compatibility behavior;
3. add or update deterministic conformance fixtures;
4. document privacy and abuse implications; and
5. avoid introducing assumptions about Nuvio, Stremio, Supabase, or a specific
   media source.

Protocol changes require an explicit versioning and migration story. Client or
provider integrations belong in their respective repositories unless they are
small reference adapters used only by conformance tests.

Contributions are accepted under the Apache License 2.0 used by this project.
