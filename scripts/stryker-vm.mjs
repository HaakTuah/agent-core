// The fault Stryker switches on handed to the code a test runs in a `vm` context (#1361, point 26), loaded by
// stryker.mjs, beside this file, before each test it runs with `node` (`node --import <this file> <the test>`). The code
// Stryker puts its faults in reads the one switched on from `globalThis.process.env.__STRYKER_ACTIVE_MUTANT__` (its
// instrumenter's header), and a test's `vm` context most often holds no `process`, so every fault in code a test loads
// so would survive, its test never running it. This gives each context made by node:vm's createContext,
// runInNewContext or a Script's runInNewContext, from an object not yet a context, the fault in Stryker's own place for
// it, `__stryker__.activeMutant`, which that header reads first, as a property no loop over the object's keys sees. It
// changes nothing where no fault is switched on (Stryker's first run, and each test as it stands), and nothing of a
// context the test made itself before, or an object that already holds `__stryker__`. It does not mean a test's
// context gains `process` or any other of the test's globals. Node's own modules alone.
import vm from "node:vm";
import { syncBuiltinESMExports } from "node:module";

const ACTIVE = "__STRYKER_ACTIVE_MUTANT__", NAMESPACE = "__stryker__";

// The object a context is made from, given the fault where it is one to give it to: a new object where none is given.
export function handed(object, active = process.env[ACTIVE]) {
  if (!active) return object;
  const into = object === undefined ? {} : object;
  if (into === null || typeof into !== "object" || vm.isContext(into) || Object.hasOwn(into, NAMESPACE)) return object;
  Object.defineProperty(into, NAMESPACE, { value: { activeMutant: active }, writable: true, configurable: true, enumerable: false });
  return into;
}

if (process.env[ACTIVE]) {
  const { createContext, runInNewContext } = vm, script = vm.Script.prototype.runInNewContext;
  vm.createContext = function (object, ...rest) { return createContext.call(this, handed(object), ...rest); };
  vm.runInNewContext = function (code, object, ...rest) { return runInNewContext.call(this, code, handed(object), ...rest); };
  vm.Script.prototype.runInNewContext = function (object, ...rest) { return script.call(this, handed(object), ...rest); };
  syncBuiltinESMExports();
}
