# What a script of the core's shows of a log on its error output, with the temporary folder it gives and the home
# folder named, never written out: on a runner on the owner's own computer each holds the account's name (#1223). Each
# is replaced as written and, where cygpath stands (Git for Windows), as Windows writes it too. Sourced, beside it, by
# lychee.sh and workflow-tools.sh:
#
#   tail -n 5 "$log" | unnamed "$temp" >&2
#
# (personal-terms.yml, which runs in a project's checkout where the core's scripts are not, writes no such path to its
# log instead: its fetch names each from the folder it works in)
unnamed() {
  local l t=$1 h=${HOME:-} tw= hw=
  if command -v cygpath > /dev/null 2>&1; then tw=$(cygpath -w "$t" 2> /dev/null); hw=$(cygpath -w "$h" 2> /dev/null); fi
  while IFS= read -r l || [ -n "$l" ]; do
    [ "${#t}" -gt 1 ] && l=${l//"$t"/'<temp>'}; [ "${#tw}" -gt 3 ] && l=${l//"$tw"/'<temp>'}
    [ "${#h}" -gt 1 ] && l=${l//"$h"/'~'}; [ "${#hw}" -gt 3 ] && l=${l//"$hw"/'~'}
    printf '%s\n' "$l"
  done
}
