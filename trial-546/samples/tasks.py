import os, pickle, subprocess, ast
def run(arg):
    cmd = "ls " + arg
    subprocess.run(cmd, shell=True)            # BAD py-cmd-1
def remove(name):
    os.system("rm " + name)                    # BAD py-cmd-2
def load(data):
    return pickle.loads(data)                  # BAD py-deser-1
def find(cur, uid):
    cur.execute("SELECT * FROM t WHERE id = %s" % uid)   # BAD py-sql-1
def calc(expr):
    return eval(expr)                          # BAD py-eval-1
def ok1(arg):
    subprocess.run(["ls", arg])                # SAFE py-cmd-list
def ok2(cur, uid):
    cur.execute("SELECT * FROM t WHERE id = %s", (uid,))  # SAFE py-sql-param
def ok3(expr):
    return ast.literal_eval(expr)              # SAFE py-eval-literal
def ok4():
    cmd = "uptime"
    subprocess.run(cmd, shell=True)            # SAFE py-cmd-const
