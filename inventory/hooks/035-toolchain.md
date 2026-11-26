- `scripts/toolchain.mjs`, `tests/toolchain-test.mjs`: fetches, for a release's trial, the .NET SDK a project's `global.json`
  pins, only where its own list holds its SHA-512, to a folder outside every repository (#1361, point 21).
  *Runs:* the trial's set-up, by its builder, from the clone of the core under trial. *Else:* Microsoft's
  `dotnet-install.sh`, itself fetched from dot.net with no digest, which the publisher's documentation names no
  checksum step for (it asks the reader to run `sha512sum -c` by hand); mise's dotnet backend, which runs that same
  script; the distribution's own packages, which carry only some bands. *Bugs:* 0. **Keep:** one pin, held to a digest
  in the core's list as `scripts/node.sh` holds Node's; it joins #534's point 5 **try** (aqua or mise, for what no
  registry carries) once that tries a backend that checks a download against its digest.
