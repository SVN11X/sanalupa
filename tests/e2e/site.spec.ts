import {test,expect} from '@playwright/test';import AxeBuilder from '@axe-core/playwright';import {readFile} from 'node:fs/promises';import {syntheticCatalog,syntheticRatingsCatalog} from '../fixtures/synthetic';
const catalog=JSON.parse(await readFile('public/data/catalog.json','utf8'));
// External tiles are blocked in automated QA to avoid bot-driven downloads under OSM policy.
test.beforeEach(async({page})=>{await page.route('https://tile.openstreetmap.org/**',route=>route.abort());});
for(const width of [360,768,1280])test('real catalogue, responsive layout and accessible forms at '+width,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:900});await page.goto('/');await expect(page.getByRole('heading',{name:'18 centros',exact:true})).toBeVisible();await expect(page.locator('body')).not.toContainText('FICTIC');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const result=await new AxeBuilder({page}).analyze();expect(result.violations).toEqual([]);expect(errors).toEqual([]);
});
test('search, detail and return preserve filters; favorites survive reload and can be deleted',async({page})=>{await page.goto('/');await page.getByLabel('Buscar por nombre, especialidad o comuna').fill('santa lucia');await page.getByRole('button',{name:'Buscar',exact:true}).click();await expect(page.getByRole('heading',{name:'1 centros',exact:true})).toBeVisible();await page.getByRole('button',{name:'Guardar favorito: Centro Médico Santa Lucía',exact:true}).click();await page.reload();await expect(page.getByRole('button',{name:'Quitar de favoritos: Centro Médico Santa Lucía',exact:true})).toBeVisible();await page.getByRole('button',{name:'Ver ficha',exact:true}).click();await expect(page.getByRole('heading',{name:'Centro Médico Santa Lucía',exact:true,level:1})).toBeVisible();await page.getByRole('link',{name:'Volver a resultados',exact:true}).click();await expect(page.getByLabel('Buscar por nombre, especialidad o comuna')).toHaveValue('santa lucia');await page.goto('/#/privacidad');await page.getByRole('button',{name:'Eliminar todos mis favoritos'}).click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('salud-cerca:favorites:v1')??'[]'))).toEqual([]);});
test('compare up to three centers and refuse fourth',async({page})=>{await page.goto('/');const buttons=page.getByRole('button',{name:/^Comparar /});await buttons.nth(0).click();await buttons.nth(1).click();await buttons.nth(2).click();await buttons.nth(3).click();await expect(page.locator('.toast')).toContainText('hasta 3');await page.getByRole('button',{name:'Comparar selección',exact:true}).click();await expect(page.getByRole('table')).toBeVisible();expect(await page.locator('thead th').count()).toBe(4);await expect(page.locator('table')).toContainText('No aplica a ficha de centro');});
test('professional catalogue empty state is honest and no rating order enabled',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Profesionales 0',exact:true}).click();await expect(page.getByRole('heading',{name:'Perfiles individuales pendientes'})).toBeVisible();await expect(page.getByRole('link',{name:/Consultar registro oficial/})).toBeVisible();await expect(page.locator('#sort option[value="rating"]')).toBeDisabled();});
test('keyboard search and denied geolocation keep comuna usable',async({page,context})=>{await context.clearPermissions();await page.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(_ok:any,fail:any)=>fail({code:1})}});});await page.goto('/');await page.getByLabel('Buscar por nombre, especialidad o comuna').focus();await page.keyboard.type('Recoleta');await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'1 centros',exact:true})).toBeVisible();if(await page.getByRole('button',{name:'Filtros',exact:true}).isVisible())await page.getByRole('button',{name:'Filtros',exact:true}).click();await page.getByRole('button',{name:'Usar mi ubicación'}).click();await expect(page.locator('.location-box')).toContainText('elegir una comuna');await expect(page.getByLabel('Comuna',{exact:true})).toBeEnabled();});
test('map markers match all filtered sites, activate same ficha without downloading real tiles',async({page})=>{await page.goto('/');await page.getByLabel('Comuna',{exact:true}).selectOption('Recoleta');await page.getByRole('button',{name:'Ver mapa',exact:true}).click();await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1);await page.locator('.leaflet-marker-icon').click();await expect(page.getByRole('heading',{name:'Sapu Valdivieso',exact:true,level:1})).toBeVisible();});
test('local synthetic professional fixture exercises verified credentials, comparison and authorized opinions',async({page})=>{const c=syntheticCatalog();await page.route('**/data/catalog.json',route=>route.fulfill({json:c}));await page.goto('/#/buscar?tipo=professional');await expect(page.getByRole('heading',{name:'3 profesionales',exact:true})).toBeVisible();await page.getByRole('button',{name:'Comparar Ana FICTICIA Uno',exact:true}).click();await page.getByRole('button',{name:'Comparar Luis FICTICIO Tres',exact:true}).click();await page.getByRole('button',{name:'Comparar selección'}).click();await expect(page.getByRole('table')).toContainText('Credenciales verificadas');await expect(page.getByRole('table')).toContainText('100 opiniones');});
test('catalogue loading failure has retry and no invented results',async({page})=>{await page.route('**/data/catalog.json',route=>route.fulfill({status:503,body:''}));await page.goto('/');await expect(page.getByRole('heading',{name:'No se pudo cargar el catálogo'})).toBeVisible();await page.unroute('**/data/catalog.json');await page.getByRole('button',{name:'Volver a intentar'}).click();await expect(page.getByRole('heading',{name:'18 centros',exact:true})).toBeVisible();});

test('catálogo FICTICIO con valoraciones: pestaña Profesionales por defecto, orden por volumen, estrellas, búsqueda en vivo y chips',async({page})=>{
 const c=syntheticRatingsCatalog(catalog);await page.route('**/data/catalog.json',route=>route.fulfill({json:c}));
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1280,height:900});await page.goto('/');
 await expect(page.getByRole('button',{name:/^Profesionales/})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('heading',{name:'5 profesionales',exact:true})).toBeVisible();
 await expect(page.locator('#sort')).toHaveValue('rating');
 await expect(page.locator('.ranking-options')).toContainText('Según opiniones en Doctoralia Chile');
 const names=await page.locator('.result-card h3').allInnerTexts();
 expect(names.slice(0,4)).toEqual(['Ana FICTICIA Cuatro Ocho','Beto FICTICIO Cuatro Cinco','Carla FICTICIA Cuatro','Dario FICTICIO Cinco Dos']);
 await expect(page.locator('.result-card').first().locator('.stars')).toHaveCount(1);
 await expect(page.locator('.result-card').first().locator('.sr-only',{hasText:'4,8 de 5 estrellas, 200 opiniones, Doctoralia'})).toHaveCount(1);
 await expect(page.locator('.result-card').last()).toContainText('Sin opiniones publicadas');
 await expect(page.locator('.coverage-note')).toContainText('5 profesionales y 18 centros');
 await expect(page.getByRole('button',{name:/^Centros/})).toContainText('18');
 await page.getByLabel('Buscar por nombre, especialidad o comuna').fill('pediatría');
 await expect(page.getByRole('heading',{name:'1 profesionales',exact:true})).toBeVisible();
 await page.getByLabel('Buscar por nombre, especialidad o comuna').fill('');
 await expect(page.getByRole('heading',{name:'5 profesionales',exact:true})).toBeVisible();
 await page.getByLabel('Comuna',{exact:true}).selectOption('Ñuñoa');
 await expect(page.getByRole('list',{name:'Filtros activos'})).toContainText('Comuna: Ñuñoa');
 await page.getByRole('button',{name:'Quitar filtro Comuna: Ñuñoa'}).click();
 await expect(page.getByRole('list',{name:'Filtros activos'})).toHaveCount(0);
 await page.locator('.result-card h3 a').first().click();
 await expect(page.getByRole('heading',{level:1})).toHaveText('Ana FICTICIA Cuatro Ocho');
 await expect(page.getByRole('link',{name:/Leer las opiniones en Doctoralia/})).toBeVisible();
 await expect(page.getByText('Las opiniones muestran la experiencia de pacientes, no la calidad clínica.')).toBeVisible();
 await expect(page.getByText('Verificación pendiente')).toBeVisible();
 await expect(page.getByRole('link',{name:/Verificar en el registro oficial/})).toBeVisible();
 const result=await new AxeBuilder({page}).analyze();expect(result.violations).toEqual([]);
 expect(errors).toEqual([]);
});
for(const width of [360,768])test('catálogo FICTICIO accesible y sin desplazamiento horizontal a '+width,async({page})=>{
 await page.route('**/data/catalog.json',route=>route.fulfill({json:syntheticRatingsCatalog(catalog)}));await page.setViewportSize({width,height:900});await page.goto('/');
 await expect(page.getByRole('heading',{name:'5 profesionales',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const result=await new AxeBuilder({page}).analyze();expect(result.violations).toEqual([]);
});
test('mapa muestra a los profesionales en sus consultas',async({page})=>{
 await page.route('**/data/catalog.json',route=>route.fulfill({json:syntheticRatingsCatalog(catalog)}));await page.goto('/');
 await expect(page.getByRole('heading',{name:'5 profesionales',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Ver mapa',exact:true}).click();
 await expect(page.locator('.leaflet-marker-icon')).toHaveCount(5);
});
test('index.html sin compilar muestra el aviso de respaldo con instrucciones',async({page})=>{
 const raw=await readFile('index.html','utf8');
 await page.route('**/sin-compilar/',route=>route.fulfill({body:raw,contentType:'text/html'}));
 await page.route('**/src/main.tsx',route=>route.fulfill({status:404,body:''}));
 await page.goto('/sin-compilar/');
 await expect(page.getByRole('alert')).toContainText('La página no pudo cargar',{timeout:8000});
 await expect(page.getByRole('alert')).toContainText('GitHub Actions');
});
