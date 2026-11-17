import os, subprocess
CMD = "uptime"
def find(cur, uid):
    cur.execute(f"SELECT * FROM t WHERE id = {uid}")     # BAD h-py-sql-fstr
def run(arg):
    subprocess.run("ls " + arg, shell=True, check=True)  # BAD h-py-cmd-kw
def find2(cur, uid):
    q = "SELECT * FROM t WHERE id = " + uid
    cur.execute(q)                                       # BAD h-py-sql-var
def remove(name):
    os.system(f"rm {name}")                              # BAD h-py-cmd-fstr
def ok1():
    os.system(CMD)                                       # SAFE h-py-cmd-modconst
def ok2(cur):
    cur.execute("SELECT 1")                              # SAFE h-py-sql-lit
def ok3(cur):
    q = "SELECT " + "1"
    cur.execute(q)                                       # SAFE h-py-sql-litcat
