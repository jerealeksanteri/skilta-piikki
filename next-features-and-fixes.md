# Next version

## Fixes
- Fiscal Periods Page
    - Pending Debt Payments load awkwardly only after a certain period is opened from the "closed periods"
        - Those should only be under the period section or load instantly when page is rendered
- Start Page
    - Log Payment button should have a blue packground
    - + Button could be larger and round
- Admin Page
    - All the buttons should have the same blue background, like Log Cash Payment has


## Features
- Research if the backend could be used with PostgreSQL
    - I want to deploy another container which contains pg17 instead of SQLite
- I want to preserve the data even if pg17 container is shutdown
    - Implement this
- I want this folder to have the docker-compose.yml as dev compose and docker-compose.prod.yml as the production compose
    - I will move the production compose later to another repo
    - Both composes should be using pg17
