# 0007. Custom fields

Status: accepted (2026-10-19). Builds on [0003](0003-projects-and-columns.md), [0004](0004-tasks.md) and [0006](0006-labels-comments-history.md): Fields belong to a Project like Columns, and their values sit on the task row like `label_ids`.

## Context

A Project needs properties of its own ("Size", "Customer", "Story points") that Morrow cannot fix in code. Kaneo, which Morrow references, has custom fields, but each part is built in a way Morrow does not want to copy:

- Every value is a string in one `text` column: numbers as `"3.5"`, booleans as `"true"`, multiselect as a JSON array inside text. Validation is written three times (`assert-valid-definition`, `set-custom-field-value`, `validate-task-fields`) and the copies disagree on what a number is.
- Choice options are bare strings, so renaming one is removing it. Kaneo rejects removing or renaming an option that tasks use; it rewrites values only when a field switches between dropdown and multiselect.
- A required field must have a default, and turning "required" on inserts the default into every task of the Project. A chosen value and a backfilled one look the same, and each field costs a row per task.
- Values live in a second table read by separate queries; filters ask the server for the distinct values in use.
- Hidden card fields are one global list per device, field edits leave no history, and the API is a full-replace PUT with integer positions.

## Decision

**A Field belongs to one Project** (`project_field`: name, type, fractional-index `position`, `options jsonb`, timestamps). The Project cascades. Names are 1–50 characters and unique per Project ignoring case; a Project has at most 20 Fields. **The type is fixed at creation.** If ever needed, single and multi choice may switch between each other; no other conversion is allowed.

**v1 has one type: single choice.** Text, number, date and multi choice follow in MOR-44; number and date need their own filter operators.

**Options are objects with ids**, stored in the Field's `options` as `{ id, name, color, position }`: at most 50 per Field, names unique within the Field ignoring case, colour a required hex from the label palette, the next one picked automatically. Tasks store the option id, so renaming, recolouring or reordering an option is one write to the Field row and every card updates.

**Values sit on the task row** in **`task.field_values jsonb`**, not null, default `{}`, keyed by Field id. A value that is not set is a **missing key, never `null`**. Each type has one zod schema in `@morrow/sync-schemas` that the API validates with and the web app renders with; single choice stores the option id. Like `label_ids` this skips relational integrity to avoid a shape: cards, filters and sort read values straight off `TaskRow`, and the limits keep the column small, which matters because every task row is synced.

**Writing a value** is one Procedure, `tasks.setFieldValue({ taskId, fieldId, value | null })`, in `withTxid` under the Project lock. It takes a share lock on the `project_field` row first, validates the value against the type's schema and checks that the option exists, then sets the key with `jsonb_set` or drops it with `-`. Two people setting different Fields on one Task both land; a Field delete in flight either strips the value afterwards or makes the write fail.

**Deleting a Field or an option is the single path that keeps `field_values` consistent.** In one transaction it locks the Field row, removes the key (Field) or every value holding the option id (option) from the Project's Tasks, then deletes the Field or rewrites its options. The web app confirms with the number of Tasks that hold a value, read from the `projects.fields.usage` Procedure because the `tasks` shape is on demand and the browser does not hold every Task. Moving those Tasks to another option instead is MOR-42, after bulk actions. A Task moved to another Project loses its values (MOR-15).

**No required flag and no default.** "Required" only means something if it blocks creating a Task, which hurts quick create, MCP and import; a default backfilled into existing Tasks is a bulk edit. If defaults come, they apply when a Task is created and are never backfilled.

**Permissions.** Defining Fields and options is `project: update`, like Columns, which Members hold too; deleting asks for confirmation instead of a separate grant. Setting a value is `task: update`. An archived Project refuses both.

**Sync.** The `project-fields` shape is eager and scoped by membership; Fields are few and every card needs them. That brings a Workspace page to thirteen long-polls. The `tasks` shape gains `field_values`.

**Views.** The sheet and the properties rail show every Field of the Project in Field order. Cards show a Field when it has a value and the device has not switched it off: a device preference keyed by Field id, on by default, beside the existing `showTask*` toggles. Each Field is a filter subject (`field:<id>`) with `is`, `isNot`, `isAnyOf`, `isNoneOf` and a "No value" choice; stored filters that name a deleted Field or option are dropped silently. A Task list sorts by a choice Field in option order. Grouping by a Field belongs to project views (MOR-37). Global search does not match option names.

**Where values are set.** The sheet, the properties rail, the create dialog (a chip, as labels are) and the field picker hotkey menu. The context menu comes later. Duplicating a Task copies its values. Fields are managed on a `fields` tab of the Project settings, beside `general` and `workflow`, not from the sheet.

**History.** Setting or clearing a value writes a `field_changed` task event with the Field and option names snapshotted, merged within 10 minutes like other fields. Field and option edits and the delete cascades write nothing, by the rule in ADR 0006.

**Import and export.** Export carries the Project's Fields and options by name and each Task's values by name. Import matches Fields by name, then options by name; a missing Field or option is created when the importer has `project: update`, otherwise dropped with a warning. MCP tools for Fields come with MOR-7.

## Compared with Kaneo

Values typed by one shared schema instead of strings checked three ways; options with ids, so rename and recolour rewrite nothing and delete cascades instead of being refused; no required flag or backfilled defaults; values on the task row instead of a second table and filter-values query; per-Field card toggles; value changes in task history; one Procedure per value write with a txid.

## Not now

Text, number, date and multi choice types; required Fields and defaults; Fields shared across Projects; type changes; replace-on-delete (MOR-42); group-by (MOR-37); MCP tools (MOR-7); setting values from the context menu; search over option names.

## Consequences

- Renaming or recolouring an option is one row write; deleting a Field or option rewrites every Task of the Project that held it, in one transaction.
- Anything that removes Fields or options outside the delete Procedures would leave dangling keys or ids. The web app ignores unknown keys and unknown option ids, and a test pins each cascade.
- Every task row grows by its `field_values`; at 20 Fields of short ids that stays small.
- Number and date filtering on the server (for MCP) would need `->>` casts; the web app filters in the browser and does not care.
