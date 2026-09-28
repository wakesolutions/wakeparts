# Wake Parts

ERP para tiendas de repuestos y yonkers (pequeña y mediana escala): inventario de productos, catálogo web y facturación con CAI (SAR Honduras).

Stack: Next.js 16 (App Router) · Supabase (Postgres + Auth con Google) · Tailwind 4.

## Desarrollo

```bash
npm install
npm run dev
```

Variables en `.env.local`: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. La llave publicable solo se usa en el servidor (Server Actions, Route Handlers y `proxy.ts`).

## Autenticación

Solo con Google, vía Supabase Auth (PKCE):

1. `/` → botón «Encender» → Server Action `iniciarSesionConGoogle` (`app/auth/actions.ts`).
2. Google → Supabase → `/auth/callback` intercambia el código por la sesión.
3. `proxy.ts` refresca la sesión en cada request y protege todo lo que no sea `/` o `/auth/*`.

En Supabase → Authentication → URL Configuration, las **Redirect URLs** deben incluir
`http://localhost:3000/auth/callback` y `https://wakeparts-beta.vercel.app/auth/callback`.

## Base de datos

- Esquema documentado: [`docs/database.md`](docs/database.md)
- Migraciones idempotentes (se ejecutan a mano en el SQL Editor de Supabase, en orden): [`supabase/migrations/`](supabase/migrations/)
- Documentación completa (negocio, arquitectura, diseño, bitácora): [`docs/`](docs/README.md)

## Diseño

Skeuomórfico de cabina: metal cepillado, cuero, instrumentos. Las paletas viven en `app/globals.css` como tokens bajo `[data-paleta="…"]` y se registran en `lib/paletas.ts`. Por defecto: `rojo-negro` y `rojo-blanco`. Hoy la paleta se guarda en una cookie; cuando exista la tabla de empresas vendrá de la empresa del usuario.
