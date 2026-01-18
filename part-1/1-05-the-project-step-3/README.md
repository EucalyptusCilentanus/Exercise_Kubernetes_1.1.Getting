# Exercise 1.5 - The project, step 3

- The project responds to GET / with an HTML page
- Environment variables are defined in the container spec (env)
- Verified with kubectl port-forward and browser

## Verify in cluster
kubectl get pods -l app=the-project
POD="$(kubectl get pods -l app=the-project -o jsonpath='{.items[0].metadata.name}')"
kubectl port-forward pod/"$POD" 3003:3000

Open:
http://localhost:3003/
