import importlib.util
from pathlib import Path

from playwright.sync_api import sync_playwright

path = Path(__file__).with_name('import-makerworld.py')
spec = importlib.util.spec_from_file_location('makerworld_import', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert module.valid_model_url('https://makerworld.com/es/models/3334143-tiny-flexi-skeleton')
for license_name in ('Standard Digital File License', 'CC BY-NC 4.0', 'MakerWorld Exclusive License'):
    try:
        module.commercial_permission(license_name, False)
        raise AssertionError('Restricted license passed: ' + license_name)
    except RuntimeError:
        pass
module.commercial_permission('CC BY 4.0', False)
module.commercial_permission('Standard Digital File License', True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page()
    page.set_content('''<html><head>
      <meta property="og:image" content="https://makerworld.bblmw.com/cover.webp">
      <meta property="og:description" content="A short summary">
      <script type="application/ld+json">{"@type":"3DModel","author":{"name":"Designer"}}</script>
      </head><body><main><h1>Tiny Flexi Skeleton</h1>
      <div class="model-description">A printable articulated skeleton with multiple parts and flexible joints.</div>
      <div class="model-license">CC BY 4.0</div>
      <img src="https://makerworld.bblmw.com/second.jpg"></main></body></html>''')
    model = module.extract_model(page)
    assert model['title'] == 'Tiny Flexi Skeleton', model
    assert model['description'].startswith('A printable'), model
    assert len(model['images']) == 2, model
    assert model['license'] == 'CC BY 4.0', model
    product = module.build_product(model, 'https://makerworld.com/es/models/3334143-tiny-flexi-skeleton', ['/uploads/a.webp'], 349, 'cat-0')
    assert product['published'] and product['sku'] == 'MW-3334143' and 'CC BY 4.0' in product['extra']
    browser.close()

print('MakerWorld extractor, license gate and product mapping passed')
