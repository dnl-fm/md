# ASCII

Generate ASCII diagrams from Mermaid-like syntax. Error-free box-drawing with guaranteed equal line widths.

## Usage

```bash
# From stdin
echo 'flowchart TD
    A[Start] --> B[End]' | ascii

# From file
ascii diagram.mmd

# With frame
ascii --frame diagram.mmd

# Validate existing diagram
ascii validate diagram.txt
```

## Supported Diagram Types

### 1. Flowchart

```
flowchart TD
    A[Start] --> B[Process]
    B --> C{Decision?}
    C -->|Yes| D[Action A]
    C -->|No| E[Action B]
```

Output:
```
            ┌─────────────────┐
            │      Start      │
            └─────────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │    Decision?    │
            └─────────────────┘
                     │
         ────────────┴─────────────
        Yes                      No
┌─────────────────┐      ┌─────────────────┐
│    Action A     │      │    Action B     │
└─────────────────┘      └─────────────────┘
```

### 2. ER Diagram

```
erDiagram
    EINNAHMEPLANUNG {
        int haushaltsjahr
        string mittelquelle
        int betrag_cent
    }
    EINNAHMEKONTIERUNG {
        ref einnahmeplanung
        bool rechtsverbindlichkeit "Legal binding flag"
    }
    EINNAHMEPLANUNG ||--o{ EINNAHMEKONTIERUNG : has
```

Output:
```
┌───────────────────────────┐
│      EINNAHMEPLANUNG      │
├───────────────────────────┤
│ • int haushaltsjahr       │
│ • string mittelquelle     │
│ • int betrag_cent         │
└───────────────────────────┘
              │ 1
              │
              ▼ *
┌───────────────────────────────────────────────────────┐
│                  EINNAHMEKONTIERUNG                   │
├───────────────────────────────────────────────────────┤
│ • ref einnahmeplanung                                 │
│ • bool rechtsverbindlichkeit  ◄── Legal binding flag  │
└───────────────────────────────────────────────────────┘
```

### 3. Sequence Diagram

```
sequenceDiagram
    Client ->> Server: Request
    Server ->> Database: Query
    Database -->> Server: Results
    Server -->> Client: Response
```

Output:
```
┌────────┐          ┌────────┐          ┌──────────┐
│ Client │          │ Server │          │ Database │
└────────┘          └────────┘          └──────────┘
            Request
     │───────────────────►                    │
     │                   │       Query        │
     │                   │────────────────────►
     │                   │      Results       │
     │                   ◄ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
     │     Response      │                    │
     ◄ ─ ─ ─ ─ ─ ─ ─ ─ ─ │                    │
```

### 4. State Diagram

```
stateDiagram
    [*] --> Draft
    Draft --> Pending: submit
    Pending --> Approved: approve
    Approved --> [*]
```

Output:
```
       ●
       │
       ▼
 ┌──────────┐
 │  Draft   │
 └──────────┘
       │
       │ submit
       ▼
┌───────────┐
│  Pending  │
└───────────┘
       │
       │ approve
       ▼
┌────────────┐
│  Approved  │
└────────────┘
       │
       ▼
       ●
```

### 5. Class Diagram

```
classDiagram
    class Einnahmeplanung {
        +int haushaltsjahr
        +Mittelquelle mittelquelle
        +create()
        +update()
    }
```

Output:
```
┌────────────────────────────────┐
│        Einnahmeplanung         │
├────────────────────────────────┤
│ + haushaltsjahr: int           │
│ + mittelquelle: Mittelquelle   │
├────────────────────────────────┤
│ + create()                     │
│ + update()                     │
└────────────────────────────────┘
```

### 6. Timeline

```
timeline
    title: SCENARIO A: Rechtsverbindlich = TRUE
    Kontierung : RV=true
    : Bestand +100
    Anordnung : created
    : No change
    Payment : confirmed
    : No change
```

Output:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SCENARIO A: Rechtsverbindlich = TRUE                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Timeline ─────────────────────────────────────────────────────────────────► │
│                                                                             │
│     Kontierung                  Anordnung                   Payment         │
│     RV=true                     created                     confirmed       │
│          │                          │                          │            │
│          ▼                          ▼                          ▼            │
│ ─────────●──────────────────────────●──────────────────────────●──────────► │
│          │                          │                          │            │
│     Bestand +100                No change                  No change        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7. Table

```
table
    title: Bestand Calculation Summary
    columns: Stage | RV=true | RV=false
    ---
    Kontierung only | ✅ Counts | ❌ Does not count
    Anordnung exists | ✅ Counts | ❌ Does not count
    Payment confirmed | ✅ Counts | ✅ Counts
```

Output:
```
┌───────────────────────────────────────────────────────────┐
│                Bestand Calculation Summary                │
├─────────────────────┬──────────────┬──────────────────────┤
│        Stage        │   RV=true    │       RV=false       │
├─────────────────────┼──────────────┼──────────────────────┤
│ Kontierung only     │ ✅ Counts     │ ❌ Does not count     │
│ Anordnung exists    │ ✅ Counts     │ ❌ Does not count     │
│ Payment confirmed   │ ✅ Counts     │ ✅ Counts             │
└─────────────────────┴──────────────┴──────────────────────┘
```

## Syntax Reference

### Node Shapes (Flowchart)
- `[text]` - Rectangle box
- `{text}` or `{{text}}` - Diamond (decision)
- `(text)` - Rounded box
- `([text])` - Stadium shape

### Arrows
- `-->` - Solid arrow
- `-->|label|` - Arrow with label
- `->>` - Solid arrow (sequence)
- `-->>` - Dashed arrow (sequence)

### Relationship Cardinality (ER)
- `||--||` - One to one
- `||--o{` - One to many
- `|o--o|` - Zero-or-one to zero-or-one
- `}|--|{` - Many to many

### Class Member Visibility
- `+` - Public
- `-` - Private
- `#` - Protected
- `~` - Package

## Build

```bash
make build     # Debug build
make release   # Release build
make install   # Install to ~/bin
make test      # Run tests
make wasm      # Build WASM for MD app
```

## Integration

### Agent Tool

Install and create meta file:

```bash
make install
cp ascii.meta ~/agent-tools/.ascii.meta
```

### MD App (WASM)

Build WASM module:

```bash
make wasm
```

Then integrate with the markdown renderer's fence handler.

## Architecture

```
src/
├── lib.rs      # Public API + WASM bindings
├── main.rs     # CLI entry point
├── chars.rs    # Box-drawing characters
├── error.rs    # Error types
├── parser.rs   # Mermaid syntax parser
├── layout.rs   # Layout engine (positioning)
└── render.rs   # ASCII rendering
```
