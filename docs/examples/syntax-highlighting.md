# Syntax Highlighting

MD supports syntax highlighting for 16+ programming languages.

## JavaScript / TypeScript

```javascript
// ES6 arrow functions and destructuring
const greet = ({ name, age }) => {
  console.log(`Hello ${name}, you are ${age} years old`);
  return { name, age, greeted: true };
};

async function fetchData(url) {
  const response = await fetch(url);
  return response.json();
}
```

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const getUser = async (id: number): Promise<User> => {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
};
```

## Python

```python
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class User:
    id: int
    name: str
    email: Optional[str] = None

def process_users(users: List[User]) -> dict:
    """Process a list of users and return statistics."""
    return {
        "total": len(users),
        "with_email": sum(1 for u in users if u.email),
    }

# List comprehension with filtering
active_users = [u for u in users if u.is_active]
```

## Rust

```rust
use std::collections::HashMap;

#[derive(Debug, Clone)]
struct Config {
    name: String,
    values: HashMap<String, i32>,
}

impl Config {
    fn new(name: &str) -> Self {
        Config {
            name: name.to_string(),
            values: HashMap::new(),
        }
    }

    fn get(&self, key: &str) -> Option<&i32> {
        self.values.get(key)
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = Config::new("default");
    println!("{:?}", config);
    Ok(())
}
```

## Go

```go
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type User struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email,omitempty"`
}

func (u *User) String() string {
	return fmt.Sprintf("User{ID: %d, Name: %s}", u.ID, u.Name)
}

func main() {
	http.HandleFunc("/users", func(w http.ResponseWriter, r *http.Request) {
		users := []User{{ID: 1, Name: "Alice"}}
		json.NewEncoder(w).Encode(users)
	})
	http.ListenAndServe(":8080", nil)
}
```

## SQL

```sql
-- Create tables with relationships
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    content TEXT,
    published BOOLEAN DEFAULT FALSE
);

-- Query with JOIN and aggregation
SELECT 
    u.name,
    COUNT(p.id) as post_count,
    MAX(p.created_at) as latest_post
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
WHERE p.published = TRUE
GROUP BY u.id, u.name
HAVING COUNT(p.id) > 5
ORDER BY post_count DESC
LIMIT 10;
```

## Bash

```bash
#!/bin/bash
set -euo pipefail

# Configuration
readonly LOG_FILE="/var/log/deploy.log"
readonly APP_DIR="/opt/myapp"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

deploy() {
    local version="$1"
    log "Deploying version $version..."
    
    cd "$APP_DIR" || exit 1
    git fetch origin
    git checkout "v$version"
    
    if [[ -f "package.json" ]]; then
        npm ci --production
    fi
    
    systemctl restart myapp
    log "Deployment complete!"
}

deploy "${1:-latest}"
```

## JSON

```json
{
  "name": "my-project",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.0",
    "lodash": "^4.17.21"
  },
  "scripts": {
    "start": "node index.js",
    "test": "jest --coverage"
  },
  "config": {
    "port": 3000,
    "debug": true,
    "features": ["auth", "api", "websocket"]
  }
}
```

## YAML

```yaml
# Docker Compose configuration
version: "3.8"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://db:5432/myapp
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: secret

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes

volumes:
  postgres_data:
```

## HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Page</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header class="site-header">
        <nav>
            <a href="/" class="logo">Brand</a>
            <ul class="nav-links">
                <li><a href="/about">About</a></li>
                <li><a href="/contact">Contact</a></li>
            </ul>
        </nav>
    </header>
    <main id="content">
        <h1>Welcome</h1>
        <p>This is a <strong>sample</strong> page.</p>
    </main>
    <script src="app.js"></script>
</body>
</html>
```

## CSS

```css
/* Modern CSS with custom properties */
:root {
    --color-primary: #3b82f6;
    --color-secondary: #64748b;
    --spacing-unit: 8px;
    --border-radius: 6px;
}

.card {
    background: white;
    border-radius: var(--border-radius);
    padding: calc(var(--spacing-unit) * 3);
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    transition: transform 0.2s ease;
}

.card:hover {
    transform: translateY(-2px);
}

@media (prefers-color-scheme: dark) {
    :root {
        --color-primary: #60a5fa;
    }
    
    .card {
        background: #1e293b;
    }
}
```

## PHP

```php
<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Collection;

class UserService
{
    public function __construct(
        private readonly UserRepository $repository,
        private readonly CacheService $cache,
    ) {}

    public function getActiveUsers(): Collection
    {
        return $this->cache->remember('active_users', 3600, function () {
            return $this->repository
                ->query()
                ->where('status', 'active')
                ->orderBy('created_at', 'desc')
                ->get();
        });
    }

    public function createUser(array $data): User
    {
        $user = new User($data);
        $user->save();
        
        event(new UserCreated($user));
        
        return $user;
    }
}
```
