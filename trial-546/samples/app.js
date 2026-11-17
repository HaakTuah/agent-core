const { exec, execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
function routes(app, db) {
  app.get("/ls", (req, res) => exec(`ls ${req.query.dir}`, () => res.end()));            // BAD js-cmd-1
  app.get("/rm", (req, res) => { const name = req.query.name; const cmd = "rm " + name; exec(cmd); }); // BAD js-cmd-2
  app.get("/calc", (req, res) => res.send(String(eval(req.body.expr))));                   // BAD js-eval-1
  app.get("/user", (req, res) => db.query("SELECT * FROM users WHERE id = " + req.params.id)); // BAD js-sql-1
  app.get("/file", (req, res) => fs.readFile(path.join(__dirname, req.query.f), () => {}));   // BAD js-path-1
  app.get("/ok1", (req, res) => exec("ls -l", () => res.end()));                           // SAFE js-cmd-lit
  app.get("/ok2", (req, res) => execFile("ls", [req.query.dir]));                          // SAFE js-cmd-args
  app.get("/ok3", (req, res) => db.query("SELECT * FROM users WHERE id = ?", [req.params.id])); // SAFE js-sql-param
  app.get("/ok4", (req, res) => { const c = "uptime"; exec(c); });                         // SAFE js-cmd-const
  // a note: never call eval( on input
  app.get("/ok5", (req, res) => res.send("eval(" + "x)"));                                // SAFE js-eval-text
}
module.exports = routes;
