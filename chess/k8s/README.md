# Kubernetes manifests

Kubernetes-ready deployment for CheckMate Malayalam AI.

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.example.yaml   # copy & fill real values first
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
```

Managed Postgres + Redis (RDS/ElastiCache or operators) are recommended for
production instead of in-cluster stateful sets. Point `DATABASE_URL` /
`REDIS_URL` at them via the `checkmate-secrets` Secret.
