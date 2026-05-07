# ListoRD

ListoRD es un marketplace mobile-first y Spanish-first para Republica Dominicana. No funciona como una bolsa de empleo tradicional: muestra personas listas para trabajar, cuanto quieren ganar, cuando pueden trabajar y senales de confianza basadas en comportamiento.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, Postgres y Storage
- Vercel-ready

## Funciones incluidas

- Homepage con solo trabajadores reales verificados.
- Filtros por ciudad, habilidad, ingreso maximo y disponibilidad hoy.
- Tarjetas con foto, ciudad, habilidades, ingreso deseado, duracion preferida, rating y senales de cumplimiento.
- Capa simple de Work Style Fit para mostrar y filtrar por estilo natural de trabajo.
- Sistema de Hiring Outcome para confirmar si el contacto termino en contratacion real.
- Registro real para trabajadores con aprobacion antes de publicacion.
- Flujo de solicitud de contacto para empleadores.
- Pagina de monetizacion suave: 2 contactos gratis, RD$99 / semana y RD$199 / mes.
- Estado vacío seguro cuando Supabase no está configurado o no tiene datos publicados.

## Configuracion local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre `http://localhost:3000`.

## Supabase

1. Crea un proyecto en Supabase.
2. Copia `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local`.
3. Ejecuta el SQL de `supabase/schema.sql` en el SQL Editor de Supabase.
4. Crea un bucket publico de Storage para fotos de trabajadores llamado `worker-photos`, o cambia `WORKER_PHOTOS_BUCKET` si usas otro nombre.
5. Activa Auth con el proveedor que prefieras.

Los trabajadores nuevos se guardan con `is_verified = false`. Para aprobar un perfil real desde Supabase, actualiza el registro:

```sql
update public.workers
set is_verified = true
where id = 'WORKER_ID_REAL';
```

Los seeds y perfiles pendientes no se muestran publicamente hasta que sean aprobados.

No uses `SUPABASE_SERVICE_ROLE_KEY` en variables `NEXT_PUBLIC_*`. La service role key nunca debe llegar al navegador.

## Stripe

Configura `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEEKLY_PRICE_ID`, `STRIPE_MONTHLY_PRICE_ID` y `SUPABASE_SERVICE_ROLE_KEY` en variables privadas del servidor. En Stripe, apunta el webhook de `checkout.session.completed` a `https://TU_DOMINIO/api/stripe/webhook`.

## Modelo de confianza

La filosofia del producto es `Realidad > palabras`.

La confianza sale de comportamiento verificable:

- Se presento.
- Completo trabajos.
- Respondio.
- Pago claro.

La monetizacion no bloquea empleo. El pago compra velocidad, prioridad y confianza: empleadores gratis pueden navegar y pedir contacto; empleadores pagos pueden contactar por WhatsApp mas rapido.

## Hiring Outcome

Despues de 24 a 48 horas de un contacto, ListoRD puede pedir una respuesta de un toque:

- Empleador: `¿Contrataste a esta persona?`
- Trabajador: `¿Te contrataron?`

Si ambos responden `Si`, el resultado queda como `hired`. Si ambos responden `No`, queda como `not_hired`. Si hay diferencia, queda `pending`.

Estos resultados alimentan:

- `workers.hired_count`
- `workers.hire_rate`
- `employers.successful_hires_count`

## Despliegue en Vercel

1. Importa el repo en Vercel.
2. Agrega las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Agrega `SUPABASE_SERVICE_ROLE_KEY` como variable privada de servidor en Vercel. No uses prefijo `NEXT_PUBLIC_`.
4. Agrega `NEXT_PUBLIC_APP_URL` con la URL publica de produccion.
5. Despliega.

## Dominio publico

1. Compra el dominio en tu registrador preferido.
2. En Vercel, abre el proyecto y ve a `Settings > Domains`.
3. Agrega el dominio y sigue las instrucciones DNS de Vercel.
4. Cuando Vercel marque el dominio como valido, actualiza `NEXT_PUBLIC_APP_URL` a `https://TU_DOMINIO`.
5. En Stripe, actualiza el webhook de produccion a `https://TU_DOMINIO/api/stripe/webhook`.
6. Redeploy en Vercel despues de cambiar variables de entorno.

Antes de lanzar, revisa `PRODUCTION_CHECKLIST.md`.

## Siguientes piezas de producto

- Integracion de pagos para RD$99 / semana y RD$199 / mes.
- Panel de trabajador para aceptar o rechazar solicitudes.
- Eventos de reputacion para show-up, pago y respuesta.
