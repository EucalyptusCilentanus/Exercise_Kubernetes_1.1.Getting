# Exercise 1.6 — The project, step 4

This exercise enables external access to the project using a **NodePort Service**.

## Files
- `manifests/deployment.yaml` — Deployment for `the-project`
- `manifests/service.yaml` — NodePort Service `the-project-svc` (nodePort 30080)

## Deploy
```bash
kubectl apply -f 1.6/the-project-step-4/manifests/deployment.yaml
kubectl apply -f 1.6/the-project-step-4/manifests/service.yaml
```

## Verify
```bash
kubectl get deploy the-project -o wide
kubectl get pods -l app=the-project -o wide
kubectl get svc the-project-svc -o wide
kubectl get endpoints the-project-svc -o wide
```

## Access from host (k3d example)
If your k3d cluster maps `8082 -> 30080`, you can access the service via:

```bash
curl -i http://localhost:8082/
curl -i http://localhost:8082/healthz
```
