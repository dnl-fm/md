# Mermaid Diagrams

MD renders Mermaid diagrams as interactive SVG graphics with theme-aware colors.

## Flowchart

```mermaid
flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> E[Check logs]
    E --> F[Fix issue]
    F --> B
    C --> G[Deploy]
    G --> H[End]
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant D as Database

    U->>F: Click login
    F->>A: POST /auth/login
    A->>D: Query user
    D-->>A: User data
    A-->>F: JWT token
    F-->>U: Redirect to dashboard
    
    Note over F,A: Token stored in localStorage
```

## Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ POST : writes
    USER ||--o{ COMMENT : writes
    POST ||--o{ COMMENT : has
    POST }o--|| CATEGORY : belongs_to
    
    USER {
        int id PK
        string name
        string email UK
        datetime created_at
    }
    
    POST {
        int id PK
        int user_id FK
        int category_id FK
        string title
        text content
        boolean published
    }
    
    COMMENT {
        int id PK
        int user_id FK
        int post_id FK
        text content
    }
    
    CATEGORY {
        int id PK
        string name UK
        string slug UK
    }
```

## State Diagram

```mermaid
stateDiagram-v2
    [*] --> Draft
    
    Draft --> Review: Submit
    Review --> Draft: Request changes
    Review --> Approved: Approve
    Approved --> Published: Publish
    Published --> Archived: Archive
    
    Draft --> [*]: Delete
    Archived --> [*]: Delete
    
    state Review {
        [*] --> Pending
        Pending --> InProgress: Assign reviewer
        InProgress --> Complete: Finish review
        Complete --> [*]
    }
```

## Class Diagram

```mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +makeSound() void
        +move() void
    }
    
    class Dog {
        +String breed
        +makeSound() void
        +fetch() void
    }
    
    class Cat {
        +boolean indoor
        +makeSound() void
        +climb() void
    }
    
    class Bird {
        +float wingspan
        +makeSound() void
        +fly() void
    }
    
    Animal <|-- Dog
    Animal <|-- Cat
    Animal <|-- Bird
    
    class Owner {
        +String name
        +List~Animal~ pets
        +adopt(Animal a) void
    }
    
    Owner "1" --> "*" Animal : owns
```

## Gantt Chart

```mermaid
gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    
    section Planning
    Requirements     :a1, 2024-01-01, 7d
    Design           :a2, after a1, 14d
    
    section Development
    Backend API      :b1, after a2, 21d
    Frontend UI      :b2, after a2, 28d
    Integration      :b3, after b1, 7d
    
    section Testing
    Unit Tests       :c1, after b1, 14d
    E2E Tests        :c2, after b3, 7d
    
    section Release
    Beta Release     :milestone, m1, after c2, 0d
    Bug Fixes        :d1, after m1, 14d
    Production       :milestone, m2, after d1, 0d
```

## Pie Chart

```mermaid
pie showData
    title Browser Market Share
    "Chrome" : 65
    "Safari" : 19
    "Firefox" : 8
    "Edge" : 5
    "Other" : 3
```

## Git Graph

```mermaid
gitGraph
    commit id: "Initial"
    branch develop
    checkout develop
    commit id: "Add feature A"
    commit id: "Add feature B"
    checkout main
    merge develop id: "Release v1.0"
    branch hotfix
    checkout hotfix
    commit id: "Fix bug"
    checkout main
    merge hotfix id: "Hotfix v1.0.1"
    checkout develop
    commit id: "Add feature C"
    checkout main
    merge develop id: "Release v1.1"
```

## Mindmap

```mermaid
mindmap
  root((Project))
    Frontend
      React
      TypeScript
      Tailwind CSS
    Backend
      Node.js
      PostgreSQL
      Redis
    DevOps
      Docker
      GitHub Actions
      AWS
    Documentation
      README
      API Docs
      Changelog
```
