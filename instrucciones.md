
Drifto — Documento simple

1) Qué vamos a hacer (en una frase)

Un teclado móvil que, mientras escribes “jueves 3pm”, te muestra la hora convertida para la otra persona y (si pagas Pro) propone la mejor hora y manda la invitación al calendario.

2) Piezas del producto
	•	App móvil (React Native): pantallas de onboarding, privacidad, ajustes y pago Pro.
	•	Teclado iOS (Swift nativo) + luego Android IME: chips de horarios y botón “Insertar”.
	•	Backend (Next.js): lógica Pro (sugerencias, calendario).
	•	Base de datos (Supabase): usuarios, preferencias, TZ por contacto, integraciones.
	•	Agente (Mastra.ai): “cerebro” que sugiere horarios y prepara invitaciones.

3) Cómo funciona (simple)
	1.	El usuario instala la app y habilita el teclado.
	2.	Escribe en cualquier chat “¿jueves 3pm?” → el teclado muestra chips con conversiones.
	3.	Toca Insertar → pega el texto ya convertido.
	4.	Si activa Pro: habilita “Full Access” del teclado → puede ver mejores horas y mandar invitación al calendario.

4) Fases (paso a paso)

Fase 1 (Free, on-device):
	•	Teclado iOS con chips de conversión (EN/ES).
	•	App con: privacidad, formato 12/24h, TZ manual por contacto.
	•	Sin internet desde el teclado. Punto.

Fase 2 (Pro):
	•	Pedimos “Full Access” (explicado).
	•	Sugerencias “mejores horas” (desde backend).
	•	Botón “Añadir a calendario” (Google/Outlook).
	•	Guardrails para no meter la pata (ver agente).

Fase 3:
	•	Teclado Android.
	•	Frases adicionales y grupos multi-zona.

5) Agente Mastra (cómo lo modelamos)
	•	Nombre/rol: SchedulingBrain.
	•	Personalidad: conservador, claro, cero adivinanzas.
	•	Reglas (importante):
	•	Nunca crea/edita eventos sin confirmación final del usuario.
	•	Si no sabe la TZ del contacto, lo dice y sugiere opciones seguras.
	•	Evita horas “locas” (madrugada) según preferencias.
	•	Si detecta conflicto, propone alternativas.
	•	Qué recuerda: TZ confirmadas por contacto, ventanas de trabajo del usuario, duraciones típicas (15/30/60).

6) Google Calendar con Mastra Tool

    •	Nuestra fuente de verdad sera el calendario del usuario, imaginemonos un calendly pero inteligente

	•	Dónde se conecta: en la App (no en el teclado). OAuth allí. Tokens guardados en el backend (cifrados).
	•	Scopes mínimos: leer disponibilidad y crear evento solo en el calendario del usuario.
	•	Tools del agente:
	1.	getAvailability(attendees, rango): devuelve bloques libres/ocupados (sin textos de eventos).
	2.	proposeSlots(preferencias + TZs): 3–5 horarios ordenados con razón (“overlap”, sin madrugadas).
	3.	createEvent(draft): solo tras “OK” del usuario; crea evento y envía invitaciones.
	•	Cinturones de seguridad:
	•	Si no hay permiso de calendario, se basará en preferencias, y lo dirá.
	•	Always-on confirmación previa: “Resumen → Confirmar → Crear”.

7) Teclado iOS (qué necesitamos)
	•	Tecnología: Swift nativo (Keyboard Extension). React Native NO hace el teclado; solo la app.
	•	Compartir datos: App Group (la app y el teclado leen/escriben preferencias).
	•	Permisos/ajustes:
	•	El teclado funciona sin red (modo Free).
	•	Para Pro pedimos “Allow Full Access” (explicando por qué).
	•	Mensajes claros: “no guardamos teclas”, “no leemos tus mensajes”, “todo local en Free”.
	•	Qué muestra:
	•	Chip con conversión instantánea y botón Insertar.
	•	En Pro: chip “Mejores horas” y botón Añadir a calendario (esto sí usa backend).

8) Backend (qué sí hace)
	•	Recibe peticiones Pro: sugerir horas, checar disponibilidad, crear invitación.
	•	Guarda tokens de calendario en server (nunca en el teclado).
	•	Jobs simples: renovar suscripciones si usamos webhooks más adelante.

9) Supabase (datos mínimos)
	•	profiles: formato de hora, idioma.
	•	contacts: nombre + TZ (si el usuario la define).
	•	prefs: ventanas de trabajo y “no madrugadas/fines”.
	•	integrations: tokens cifrados por proveedor (Google/Outlook).

10) Privacidad (lo que diremos y haremos)
	•	Free = 100% on-device, sin internet en el teclado.
	•	Pro = internet solo para sugerencias y calendario, con consentimiento.
	•	Nunca “keylogging”. Solo procesamos lo que el usuario está escribiendo. Punto.

11) Listo cuando (check simple)
	•	El teclado iOS muestra chips y pega el texto convertido.
	•	La app permite setear TZ por contacto y formato 12/24h.
	•	Pro pide Full Access y activa mejores horas + añadir a calendario con confirmación.
	•	El agente nunca crea eventos sin OK.

12) Lo que NO haremos en MVP
	•	No leemos historial de chats.
	•	No sincronizamos todos los contactos del teléfono.
	•	No metemos analíticas invasivas.

⸻

Si quieres, convierto esto tal cual en tareas cortas (10–15 tickets máximo) para pegar en Linear/Jira.