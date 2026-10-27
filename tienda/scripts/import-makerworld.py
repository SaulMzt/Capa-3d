#!/usr/bin/env python3
"""Importa un modelo de MakerWorld directamente al catálogo de CAPA 3D.

Requiere: python -m pip install playwright y Google Chrome instalado
Ejemplo: python scripts/import-makerworld.py URL --price 349
"""

import argparse
import getpass
import mimetypes
import os
import re
import sys
import time
import uuid
from urllib.parse import urlparse

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright


DEFAULT_STORE = "https://capa3d.site.je"
MODEL_PATH = re.compile(r"^/(?:[a-z]{2}/)?models/\d+(?:[-/]|$)", re.I)
COMMERCIAL_LICENSE = re.compile(r"\b(?:CC0|public domain|dominio p[úu]blico|CC[- ]BY(?:[- ]SA)?(?:\b|[- ]\d))", re.I)
RESTRICTED_LICENSE = re.compile(r"non[- ]commercial|no[- ]comercial|\bNC\b|standard digital|licencia digital est[áa]ndar|exclusive|exclusiva|\bND\b|no[- ]derivatives", re.I)


def valid_model_url(value):
    parsed = urlparse(value)
    if parsed.scheme != "https" or parsed.hostname not in {"makerworld.com", "www.makerworld.com"} or not MODEL_PATH.match(parsed.path):
        raise argparse.ArgumentTypeError("Usa una URL HTTPS de un modelo de makerworld.com")
    return value


def parse_args():
    parser = argparse.ArgumentParser(description="Importa y publica un producto desde MakerWorld en CAPA 3D")
    parser.add_argument("url", type=valid_model_url, help="URL del modelo en MakerWorld")
    parser.add_argument("--price", type=float, help="Precio de venta en MXN; se solicitará si se omite")
    parser.add_argument("--category-id", help="ID de una categoría activa de la tienda")
    parser.add_argument("--base-url", default=DEFAULT_STORE, help="URL HTTPS de la tienda")
    parser.add_argument("--email", default=os.getenv("CAPA_ADMIN_EMAIL", "admin@capa.local"))
    parser.add_argument("--headless", action="store_true", help="Ejecutar Chrome sin ventana; no permite resolver verificaciones manuales")
    parser.add_argument("--rights-confirmed", action="store_true", help="Confirmas que tienes permiso comercial explícito para este modelo y sus imágenes")
    parser.add_argument("--chromium", action="store_true", help="Usar Chromium de Playwright en lugar de Chrome instalado")
    return parser.parse_args()


def api(context, base, path, method="GET", **kwargs):
    url = base.rstrip("/") + "/api/" + path
    response = context.request.fetch(url, method=method, timeout=30000, **kwargs)
    try:
        body = response.json()
    except Exception as exc:
        raise RuntimeError(f"{path}: respuesta no JSON (HTTP {response.status})") from exc
    if not response.ok:
        raise RuntimeError(f"{path}: HTTP {response.status}: {body.get('error', body)}")
    return body


def wait_for_model(page, url):
    response = page.goto(url, wait_until="domcontentloaded", timeout=45000)
    deadline = time.monotonic() + 120
    warned = False
    while True:
        title = page.title().lower()
        body = page.locator("body").inner_text(timeout=10000).lower()[:1000]
        challenge = any(word in title + " " + body for word in ("just a moment", "un momento", "verificación de seguridad", "checking your browser"))
        if not challenge:
            if response and response.status >= 400 and not warned:
                raise RuntimeError(f"MakerWorld respondió HTTP {response.status}")
            page.locator("h1").first.wait_for(timeout=20000)
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(1500)
            page.evaluate("window.scrollTo(0, 0)")
            return
        if not warned:
            print("MakerWorld solicita verificación. Resuélvela en la ventana de Chrome; el script esperará hasta 2 minutos.")
            warned = True
        if time.monotonic() >= deadline:
            raise RuntimeError("MakerWorld no permitió leer la página. Inténtalo desde tu navegador; no se creó ningún producto.")
        page.wait_for_timeout(2000)


def extract_model(page):
    result = page.evaluate("""() => {
      const meta = (selector) => document.querySelector(selector)?.getAttribute('content')?.trim() || '';
      const plain = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim();
      const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(s => {
        try { const value = JSON.parse(s.textContent); return Array.isArray(value) ? value : [value]; } catch { return []; }
      });
      const node = ld.find(x => x?.['@type'] === '3DModel' || x?.['@type'] === 'Product' || x?.['@type'] === 'CreativeWork') || {};
      const title = plain(document.querySelector('h1')?.textContent || meta('meta[property="og:title"]') || node.name || document.title.replace(/\\s*[-|].*MakerWorld.*$/i,''));
      const descriptionNodes = [...document.querySelectorAll('main [data-testid*="description"], main [class*="description"], main [id*="description"], article [class*="description"]')]
        .map(x => plain(x.innerText)).filter(x => x.length > 40 && x.length < 6000);
      const description = descriptionNodes.sort((a,b) => b.length - a.length)[0] || plain(node.description || meta('meta[property="og:description"]') || meta('meta[name="description"]'));
      const imageCandidates = [meta('meta[property="og:image"]'), ...(Array.isArray(node.image) ? node.image : [node.image]),
        ...[...document.querySelectorAll('main img, article img')].map(x => x.currentSrc || x.src || x.getAttribute('data-src'))];
      const images = [...new Set(imageCandidates.filter(Boolean).map(x => { try { return new URL(x, location.href).href; } catch { return ''; } }))]
        .filter(x => /^https:\\/\\//.test(x) && !/avatar|profile|logo|icon/i.test(x)).slice(0, 12);
      const licenseNodes = [...document.querySelectorAll('main [class*="license"], main [class*="License"], main [data-testid*="license"], main a[href*="license"], article [class*="license"]')]
        .map(x => plain(x.innerText || x.getAttribute('title'))).filter(x => x && x.length < 250);
      const licenseText = licenseNodes.find(x => /CC0|creative commons|CC[- ]BY|standard digital|exclusive|licen[sc]|public domain/i.test(x)) ||
        (document.body.innerText.match(/(?:Standard Digital File License|MakerWorld Exclusive License|CC0(?: [0-9.]+)?|CC[- ]BY(?:[- ](?:SA|NC|ND))*[ -]?[0-9.]*)/i)?.[0] || '') || plain(node.license);
      const author = plain(node.author?.name || meta('meta[name="author"]') || document.querySelector('main a[href*="/@"]')?.textContent);
      return {title, description, images, license: licenseText, author};
    }""")
    if not result["title"] or len(result["title"]) < 2:
        raise RuntimeError("No se pudo extraer el título del modelo")
    if not result["description"]:
        raise RuntimeError("No se pudo extraer la descripción del modelo")
    if not result["images"]:
        raise RuntimeError("No se encontraron imágenes del modelo")
    if not result["license"]:
        raise RuntimeError("No se encontró la licencia; no se creó ningún producto")
    return result


def commercial_permission(license_name, rights_confirmed):
    if rights_confirmed:
        return
    if RESTRICTED_LICENSE.search(license_name) or not COMMERCIAL_LICENSE.search(license_name):
        raise RuntimeError(
            f"La licencia «{license_name}» no acredita venta comercial. "
            "No se publicó nada. Si tienes permiso comercial para el modelo y sus imágenes, ejecuta de nuevo con --rights-confirmed."
        )


def upload_images(context, base, images):
    uploaded = []
    for index, url in enumerate(images, 1):
        source = context.request.get(url, timeout=30000)
        if not source.ok:
            raise RuntimeError(f"No se pudo descargar la imagen {index} (HTTP {source.status})")
        mime = source.headers.get("content-type", "").split(";")[0].lower()
        if mime not in {"image/png", "image/jpeg", "image/webp"}:
            raise RuntimeError(f"La imagen {index} tiene formato no admitido: {mime}")
        content = source.body()
        if len(content) > 5 * 1024 * 1024:
            raise RuntimeError(f"La imagen {index} supera 5 MB")
        name = f"makerworld-{index}{mimetypes.guess_extension(mime) or '.jpg'}"
        response = api(context, base, "admin/upload", "POST", multipart={"file": {"name": name, "mimeType": mime, "buffer": content}})
        uploaded.append(response["url"])
        print(f"Imagen {index}/{len(images)} subida")
    return uploaded


def build_product(model, url, images, price, category_id):
    identity = re.search(r"/models/(\d+)", url).group(1)
    credit = f"Fuente: {url}\nLicencia: {model['license']}"
    if model["author"]:
        credit += f"\nDiseñador: {model['author']}"
    return {
        "id": str(uuid.uuid5(uuid.NAMESPACE_URL, "makerworld:" + identity)),
        "name": model["title"][:150], "description": model["description"][:5000],
        "price": round(price, 2), "oldPrice": 0, "offer": False,
        "categoryId": category_id, "subcategory": "", "dimensions": "",
        "size": "Mediano", "material": "PLA", "colors": "",
        "fabrication": "2–3 días", "delivery": "3–5 días hábiles",
        "sku": "MW-" + identity, "status": "Disponible", "stock": 0,
        "unlimited": True, "lowStock": 3, "featured": False,
        "isNew": True, "recommended": False, "published": True,
        "extra": credit[:3000], "images": images,
    }


def main():
    args = parse_args()
    base = args.base_url.rstrip("/")
    if urlparse(base).scheme != "https":
        raise RuntimeError("La API de la tienda debe usarse por HTTPS")
    price = args.price
    if price is None:
        price = float(input("Precio de venta en MXN: ").strip())
    if not 0 < price <= 1_000_000:
        raise RuntimeError("El precio debe ser mayor que cero y no superar 1 000 000 MXN")
    with sync_playwright() as playwright:
        launch_args = {"headless": args.headless}
        if not args.chromium:
            launch_args["channel"] = "chrome"
        browser = playwright.chromium.launch(**launch_args)
        try:
            context = browser.new_context(locale="es-ES")
            page = context.new_page()
            wait_for_model(page, args.url)
            model = extract_model(page)
            print(f"Modelo: {model['title']}\nLicencia: {model['license']}\nImágenes: {len(model['images'])}")
            commercial_permission(model["license"], args.rights_confirmed)
            password = os.getenv("CAPA_ADMIN_PASSWORD") or getpass.getpass("Contraseña del administrador: ")
            site_page = context.new_page()
            site_page.goto(base + "/admin", wait_until="domcontentloaded", timeout=30000)
            api(context, base, "auth/login", "POST", data={"email": args.email, "password": password})
            admin = api(context, base, "admin")
            category = args.category_id or next((c["id"] for c in admin["categories"] if c["active"]), "")
            if not category or category not in {c["id"] for c in admin["categories"] if c["active"]}:
                raise RuntimeError("Indica una categoría activa con --category-id")
            images = upload_images(context, base, model["images"])
            product = build_product(model, args.url, images, price, category)
            api(context, base, "admin/products", "POST", data=product)
            print("Publicado:", base + "/productos/" + product["id"])
        finally:
            browser.close()


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, PlaywrightError, ValueError, EOFError) as exc:
        print("Error:", exc, file=sys.stderr)
        sys.exit(1)
