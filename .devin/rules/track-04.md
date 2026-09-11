---
description: "Track 04 Ovnicom Sentinel-DNS challenge brief — context and hard constraints for this repo"
trigger: always_on
---

# Track 04 — Ovnicom Sentinel-DNS (challenge brief)

Reto corporativo: IA Descentralizada aplicada a Infraestructura. Presentado por Ovnicom. Prize: $1,500.

## Sentinel-DNS: inteligencia local sobre telemetría DNS

**Contexto.** Ovnicom opera infraestructura de red y datacenter para clientes de banca, gobierno y salud en Panamá, Colombia, Guatemala y El Salvador. Parte de esa operación es un pipeline de telemetría DNS que captura consultas en tiempo real (BIND9 con dnstap), las normaliza y distribuye (Vector y Kafka), las almacena (ClickHouse) y las visualiza (Grafana), con Wazuh como SIEM. Hoy el análisis de ese tráfico se hace de forma centralizada y sin un componente de IA.

El problema es que el tráfico DNS revela hábitos de navegación de personas y empresas. Para los clientes regulados de Ovnicom, ni una consulta ni un dato derivado de ella puede salir del datacenter, tampoco hacia un proveedor de IA en la nube. Eso descarta las soluciones habituales y abre la puerta a una ejecución local.

## Qué construir

Un agente sobre QVAC que se conecte como consumidor adicional del stream de telemetría DNS y produzca, desde el mismo flujo de datos, dos salidas:

1. **Seguridad.** Clasificación en tiempo real de dominios sospechosos (algoritmos de generación de dominios o DGA, typosquatting, tunneling DNS, beaconing hacia servidores de comando y control) y envío de la alerta a Wazuh por webhook o API local.
2. **Experiencia de cliente.** Un score de calidad de experiencia por zona o punto de presencia, calculado a partir de latencia de resolución, tasa de NXDOMAIN y señales de saturación, escrito en ClickHouse y visualizado en un dashboard Grafana por sitio y por zona de cliente.

## Condiciones

- La inferencia corre íntegramente en el dispositivo o en el servidor local mediante QVAC. Ninguna consulta DNS ni ningún dato derivado se envía a un endpoint de inferencia en la nube. Esta es la regla general del hackathon y aquí aplica sin matices.
- El agente lee del bus de eventos sin modificar el pipeline de producción.
- Se admite combinar reglas con un modelo ligero. No se exige entrenar un modelo desde cero.
- Los datos de entrada son sintéticos. El equipo genera o utiliza un dataset que imite patrones reales, con dominios DGA de listas públicas, tráfico normal simulado y variaciones de latencia por zonas ficticias. No se entregan datos reales de clientes.

## Entregables

Los generales del hackathon: repositorio accesible para el jurado y video de demostración de máximo cinco minutos, ambos antes del 11 de septiembre a las 8:00.

## Qué mirará el jurado de Ovnicom

Esta orientación no altera la rúbrica general, que es la misma para todas las entregas. Sirve para que el equipo sepa dónde poner el énfasis.

- Que la clasificación de amenazas funcione sobre el stream y no sobre un archivo estático.
- Que las alertas lleguen a Wazuh en un formato que el SIEM pueda procesar.
- Que el score de experiencia sea interpretable por un operador de red, no solo por quien lo programó.
- Que el diseño deje claro, de forma verificable, que ningún dato sale de la infraestructura.
