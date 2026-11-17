using System.Diagnostics;
using System.Data.SqlClient;
using System.IO;
public class Svc {
  public void Run(string input) { var cmd = "/c " + input; Process.Start("cmd.exe", cmd); }          // BAD h-cs-cmd-var
  public void Find(string id, SqlConnection c) { new SqlCommand($"SELECT * FROM t WHERE id = {id}", c).ExecuteReader(); } // BAD h-cs-sql-interp
  public string Get(string name) { return File.ReadAllText("/srv/" + name); }                        // BAD h-cs-path
  public string Cfg(string unused) { return File.ReadAllText("appsettings.json"); }                  // SAFE h-cs-path-lit
  public void Log(string unused) { Process.Start("git", "log --oneline " + "-5"); }                  // SAFE h-cs-cmd-litcat
  public void Ok(SqlConnection c) { new SqlCommand("SELECT 1", c).ExecuteReader(); }                 // SAFE h-cs-sql-lit
}
