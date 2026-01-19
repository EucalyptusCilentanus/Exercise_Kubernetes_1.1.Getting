IMPORTANT: This exercise uses an Ingress. On k3s, Traefik is installed by default and acts as the Ingress controller. If your cluster has no Ingress controller, the Ingress resource will not route traffic.

IMPORTANT (k3d local): If you build the image locally (without pushing to a registry), you must import it into the k3d cluster, otherwise the Pod may fail with ImagePullBackOff.
Example:
k3d image import dwk-log-output:1.7 -c k3s-default
and in the Deployment use:
imagePullPolicy: IfNotPresent

IMPORTANT (k3d ports): To access the Ingress from your host, map host port 8081 to the k3d load balancer port 80, e.g.:
k3d cluster create k3s-default --agents 2 -p "8081:80@loadbalancer"
Then the app is reachable at:
http://localhost:8081/
http://localhost:8081/status
http://localhost:8081/healthz

# Exercise 1.7 — External access with Ingress

## Goal

The "Log output" application:
- prints a timestamp and a random startup string to logs every 5 seconds
- exposes an HTTP endpoint that returns the current status (timestamp + startupString)
- is reachable via an Ingress (Traefik in k3s)

## Repository structure

- server.js
- Dockerfile
- manifests/deployment.yaml
- manifests/service.yaml (ClusterIP)
- manifests/ingress.yaml

## Deploy

Apply manifests:

kubectl apply -f manifests/deployment.yaml
kubectl apply -f manifests/service.yaml
kubectl apply -f manifests/ingress.yaml

## Verify

Pod and resources:

kubectl get pods -l app=log-output -o wide
kubectl get svc log-output-svc -o wide
kubectl get ing log-output-ingress -o wide

Access via Ingress (with 8081->80@loadbalancer):

curl -i http://localhost:8081/
curl -i http://localhost:8081/status
curl -i http://localhost:8081/healthz

The /status endpoint must return JSON containing both:
- timestamp
- startupString

Logs:

kubectl logs -l app=log-output --tail=50 -f
