# financialclaw — Versionamiento y compatibilidad

## Versionado semántico

El plugin sigue [SemVer](https://semver.org/):

```
MAJOR.MINOR.PATCH
```

| Tipo | Cuándo incrementar | Ejemplo |
|---|---|---|
| **MAJOR** | Cambio que rompe compatibilidad (schema DB incompatible, tool renombrado/eliminado, contrato de OCR cambiado) | 1.0.0 → 2.0.0 |
| **MINOR** | Nueva funcionalidad sin romper lo existente (nuevo tool, nueva columna, nuevo enum) | 0.1.0 → 0.2.0 |
| **PATCH** | Corrección de bug, mejora de parsing, ajuste de texto | 0.1.0 → 0.1.1 |

La versión vive en `package.json` → `"version"`. OpenClaw la lee para gestionar actualizaciones.

---

## Migraciones de base de datos

### Principio fundamental

**Nunca perder datos del usuario.** La BD es local y contiene toda la información financiera. No hay backup en la nube. Una migración destructiva es irrecuperable.

### Estrategia

El plugin NO usa un framework de migraciones (no hay Prisma ni knex). La migración es **incremental e idempotente** en `database.ts`:

1. `CREATE TABLE IF NOT EXISTS` — crea tablas que no existan (seguro re-ejecutar)
2. `CREATE INDEX IF NOT EXISTS` — crea índices que no existan
3. `INSERT OR IGNORE` — seed data que no duplique
4. **Para cambios futuros**: `ALTER TABLE ... ADD COLUMN` envuelto en try/catch (SQLite no tiene `ADD COLUMN IF NOT EXISTS`)

### Cómo agregar una columna nueva

```typescript
// En schema.ts, agregar al array SCHEMA_UPDATES:
export const SCHEMA_UPDATES: string[] = [
  // v0.2.0: agregar columna notes a expenses
  `ALTER TABLE expenses ADD COLUMN notes TEXT`,
  // v0.3.0: agregar columna tags a expenses
  `ALTER TABLE expenses ADD COLUMN tags TEXT`,
];
```

```typescript
// En database.ts, después de migrate():
for (const sql of SCHEMA_UPDATES) {
  try {
    db.exec(sql);
  } catch (err: unknown) {
    // "duplicate column name" es esperado si ya se aplicó — ignorar
    const msg = err instanceof Error ? err.message : "";
    if (!msg.includes("duplicate column name")) {
      throw err;
    }
  }
}
```

### Lo que NUNCA hacer en una migración

- `DROP TABLE` — elimina datos
- `ALTER TABLE ... DROP COLUMN` — SQLite no lo soporta bien antes de 3.35, y pierde datos
- `ALTER TABLE ... RENAME COLUMN` sin mantener compatibilidad — los prepared statements existentes fallan
- Cambiar el tipo de una columna existente — SQLite no lo soporta
- Borrar filas de `currencies` que estén referenciadas por FK

### Lo que SÍ se puede hacer

- Agregar columnas con `DEFAULT` (no rompe queries existentes)
- Agregar tablas nuevas
- Agregar índices
- Insertar seed data con `INSERT OR IGNORE`

---

## Changelog

Mantener un archivo `CHANGELOG.md` en la raíz del proyecto. Formato: [Keep a Changelog](https://keepachangelog.com/).

```markdown
# Changelog

## [Unreleased]

## [0.1.0] - 2026-03-28
### Added
- Plugin inicial con 10 tools + servicio de sincronización diaria
- Soporte multi-moneda (tabla currencies, seed XXX placeholder)
- OCR de recibos vía PaddleOCR subprocess
- Base de datos SQLite embebida (7 tablas)
- Tools: manage_currency, log_expense_from_image, log_expense_manual,
  log_income, log_income_receipt, add_recurring_expense,
  mark_expense_paid, get_financial_summary, list_expenses, list_incomes
- Servicio background: generación de recurrentes, transición PENDING→OVERDUE, reminders
```

### Reglas para el changelog

- Todo cambio visible para el usuario va en el changelog (nuevo tool, bug fix, cambio de comportamiento)
- Cambios internos (refactor sin efecto visible) no van
- Cada release tiene fecha ISO
- Secciones: `Added`, `Changed`, `Fixed`, `Removed`, `Deprecated`

---

## Compatibilidad con OpenClaw

### Lo que maneja OpenClaw (no nos corresponde)

- Detectar que hay una versión nueva del plugin
- Descargar e instalar la actualización
- Notificar al usuario sobre actualizaciones disponibles
- Gestionar permisos y aprobación de tools

### Lo que nos corresponde a nosotros

| Responsabilidad | Cómo |
|---|---|
| Versión correcta | `package.json` → `"version"` actualizado en cada release |
| Migración de BD segura | `CREATE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN` idempotente |
| No romper tools existentes | No renombrar ni eliminar tools sin bump de MAJOR |
| No romper schemas | No cambiar tipos de parámetros existentes; agregar como opcionales |
| Documentar cambios | `CHANGELOG.md` actualizado |

### Reglas para mantener compatibilidad entre versiones

**Tools:**
- No renombrar un tool → crea uno nuevo y depreca el viejo
- No eliminar un parámetro existente de un tool
- Nuevos parámetros siempre `Optional` con default sensato
- No cambiar el tipo de un parámetro existente

**Base de datos:**
- Nuevas columnas siempre con `DEFAULT` o nullable
- Nunca eliminar columnas ni tablas
- Nuevas tablas se crean automáticamente al arrancar

**OCR (paddle_ocr_cli.py):**
- El contrato stdout JSON no debe perder campos existentes
- Se pueden agregar campos nuevos al JSON (los callers ignoran campos desconocidos)

---

## Proceso de release

1. Asegurar que todos los cambios estén en el changelog bajo `[Unreleased]`
2. Actualizar `"version"` en `package.json`
3. Mover los items de `[Unreleased]` a la nueva versión con fecha
4. Commit: `release: v0.2.0`
5. Tag: `git tag v0.2.0`
