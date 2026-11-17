const { exec } = require("child_process");
const fs = require("fs");
const UPTIME = "uptime";
function routes(app, db) {
  app.get("/a", (req, res) => exec("git log " + req.query.ref, () => res.end()));            // BAD h-js-cmd
  app.get("/b", (req, res) => { const q = `SELECT * FROM t WHERE n='${req.query.n}'`; db.query(q); }); // BAD h-js-sql-var
  app.get("/c", (req, res) => fs.readFile(req.params.p, () => {}));                          // BAD h-js-path-params
  app.get("/d", (req, res) => res.send(String(eval(req.query.x))));                          // BAD h-js-eval
  app.get("/e", (req, res) => exec(UPTIME, () => res.end()));                                // SAFE h-js-cmd-topconst
  app.get("/f", (req, res) => fs.readFile("config.json", () => {}));                         // SAFE h-js-path-lit
  app.get("/g", (req, res) => { const sql = "SELECT 1"; db.query(sql); });                   // SAFE h-js-sql-const
}
module.exports = routes;
