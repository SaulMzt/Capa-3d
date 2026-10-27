"""Check whether the live private Gemini key exists; never print its value."""
import ftplib
import json
from pathlib import Path

private = Path(__file__).resolve().parents[1] / '.private'
credentials = json.loads((private / 'ftp.json').read_text())
connection = ftplib.FTP_TLS()
try:
    connection.connect(credentials['host'], credentials['port'], timeout=25)
    connection.login(credentials['username'], credentials['password'])
    connection.prot_p()
    chunks = []
    try:
        connection.retrbinary('RETR capa3d.site.je/htdocs/database/gemini-key.txt', chunks.append)
    except ftplib.error_perm:
        print('No hay clave de Gemini en el servidor actual.')
    else:
        key = b''.join(chunks).strip()
        if 20 <= len(key) <= 300 and all(byte in b'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-' for byte in key):
            (private / 'gemini-key.txt').write_bytes(key)
            print('Clave de Gemini recuperada en carpeta privada; valor oculto.')
        else:
            print('La clave remota no cumple el formato esperado; no se guardó.')
finally:
    try: connection.quit()
    except Exception: connection.close()
