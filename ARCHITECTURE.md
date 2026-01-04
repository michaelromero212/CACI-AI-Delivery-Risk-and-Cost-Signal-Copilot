# Architecture Documentation

## System Overview

The CACI AI Delivery Risk & Cost Signal Copilot is a three-tier web application designed for signal detection in government program management.

```
┌──────────────────────────────────────────────────────────────┐
│                      PRESENTATION TIER                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    React + Vite                          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │ │
│  │  │Dashboard │  │ Program  │  │  Costs   │  │ Override │ │ │
│  │  │   Page   │  │  Detail  │  │Dashboard │  │  Modal   │ │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP/REST
┌──────────────────────────────────────────────────────────────┐
│                       APPLICATION TIER                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                      FastAPI                             │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │ │
│  │  │ Programs │  │  Inputs  │  │ Signals  │  │ Overrides│ │ │
│  │  │  Router  │  │  Router  │  │  Router  │  │  Router  │ │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │ │
│  │                      │              │                    │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │                  SERVICES LAYER                     │ │ │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │ │ │
│  │  │  │ Normalizer │  │  Signal    │  │   Cost     │    │ │ │
│  │  │  │            │  │ Generator  │  │  Tracker   │    │ │ │
│  │  │  └────────────┘  └────────────┘  └────────────┘    │ │ │
│  │  │                       │                             │ │ │
│  │  │               ┌───────▼───────┐                     │ │ │
│  │  │               │  LLM Client   │                     │ │ │
│  │  │               │(Hugging Face) │                     │ │ │
│  │  │               └───────────────┘                     │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼ SQLAlchemy ORM
┌──────────────────────────────────────────────────────────────┐
│                        DATA TIER                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              SQLite / PostgreSQL                         │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │ │
│  │  │ programs │  │  inputs  │  │ signals  │  │  costs   │ │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │ │
│  │                          ┌──────────┐                    │ │
│  │                          │ overrides│                    │ │
│  │                          └──────────┘                    │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Data Model

```
┌─────────────┐
│   Program   │
├─────────────┤
│ id          │
│ name        │
│ description │
│ status      │
│ created_at  │
└──────┬──────┘
       │ 1:N
       ▼
┌─────────────┐
│    Input    │
├─────────────┤
│ id          │
│ program_id  │◄─────────────────────┐
│ input_type  │                      │
│ filename    │                      │
│ raw_content │                      │
│ normalized  │                      │
│ metadata    │                      │
└──────┬──────┘                      │
       │ 1:N                         │
       ▼                             │
┌─────────────┐                      │
│   Signal    │                      │
├─────────────┤                      │
│ id          │                      │
│ input_id    │──────────────────────┤
│ program_id  │──────────────────────┘
│ signal_type │
│ signal_value│
│ confidence  │
│ explanation │
│ model_used  │
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌──────┐ ┌──────────┐
│ Cost │ │ Override │
│Metric│ │          │
├──────┤ ├──────────┤
│tokens│ │ original │
│ cost │ │ override │
│model │ │ justify  │
└──────┘ │ analyst  │
         └──────────┘
```

## Signal Flow

```
Input Upload          Normalization         LLM Analysis         Signal Storage
    │                      │                     │                     │
    ▼                      ▼                     ▼                     ▼
┌─────────┐          ┌──────────┐          ┌──────────┐          ┌─────────┐
│CSV/TXT/ │   ──►    │ Parse &  │   ──►    │ Generate │   ──►    │ Store   │
│ Manual  │          │ Extract  │          │ Prompts  │          │ Signal  │
└─────────┘          │ Metadata │          │ + Call   │          │ + Cost  │
                     └──────────┘          │ LLM      │          │ Metric  │
                                           └──────────┘          └─────────┘
                                                │                     │
                                                ▼                     ▼
                                           ┌──────────┐          ┌─────────┐
                                           │ Parse    │          │Display  │
                                           │ Response │          │in UI    │
                                           └──────────┘          └─────────┘
```

## Key Design Decisions

### 1. Fallback Mode
When no Hugging Face API key is configured, the system uses a rule-based fallback that analyzes keywords to generate signals. This enables demos without external dependencies.

### 2. Cost Tracking
Every LLM call tracks:
- Input/output tokens (estimated at 4 chars/token)
- Estimated USD cost
- Model name
- Response latency

### 3. Human-in-the-Loop
Analyst overrides require:
- New signal value
- Analyst name
- Mandatory justification (min 10 chars)

Override history is preserved for audit.

### 4. Signal Taxonomy
Simple, decision-ready values:
- **Delivery Risk**: LOW / MEDIUM / HIGH
- **Cost Risk**: NORMAL / ANOMALOUS
- **AI Efficiency**: LOW / MODERATE / HIGH

### 5. Database Flexibility
SQLite for zero-config development; PostgreSQL via DATABASE_URL for production-like environments.
