- `scripts/node.sh`: keeps the pinned Node on a session's machine, fetched by its digest. *Runs:* the cloud set-up, from
  `main`. *Else:* nvm, fnm, Volta and mise, dropped on fact: each must be installed first, by digest too; the host's
  `setup-node`, which the runners already use. *Bugs:* 0. **Keep:** small and stable, for Node. #534's point 5 widens
  it to the tools that only run, and there the challenge proposes **try**: aqua (MIT) and mise (MIT), found again, each
  keep a file of every tool's digest for each system (`aqua-checksums.json`, `mise.lock`) and refuse a download that
  does not match, which is the list of digests point 5 asks, kept by a maintained program in place of one script line
  per tool; each is itself fetched first, by its digest, as Node is. Not measured: this session's network refused the
  host's release downloads, from which both, and most of the tools, are fetched (the tools tried here came through the
  Go and npm registries instead).
