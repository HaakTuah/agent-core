using System.Diagnostics;
using System.Data.SqlClient;
using System.IO;
using System.Runtime.Serialization.Formatters.Binary;
public class Handlers {
  public void Run(string input) { Process.Start("cmd.exe", "/c " + input); }                       // BAD cs-cmd-1
  public void Find(string id, SqlConnection c) { new SqlCommand("SELECT * FROM t WHERE id = " + id, c).ExecuteReader(); } // BAD cs-sql-1
  public void Find2(string id, SqlConnection c) { var q = "SELECT * FROM t WHERE id = " + id; new SqlCommand(q, c).ExecuteReader(); } // BAD cs-sql-2
  public object Load(Stream s) { return new BinaryFormatter().Deserialize(s); }                     // BAD cs-deser-1
  public string Read(string root, string name) { return File.ReadAllText(Path.Combine(root, name)); } // BAD cs-path-1
  public void Ok1(string id, SqlConnection c) { var k = new SqlCommand("SELECT * FROM t WHERE id = @id", c); k.Parameters.AddWithValue("@id", id); } // SAFE cs-sql-param
  public void Ok2() { Process.Start("git", "status"); }                                             // SAFE cs-cmd-lit
  public void Ok3(SqlConnection c) { const string q = "SELECT 1"; new SqlCommand(q, c).ExecuteReader(); } // SAFE cs-sql-const
}
