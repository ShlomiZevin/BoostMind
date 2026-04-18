#!/bin/bash
echo "Building storyboard..."
cd storyboard && npm run build && cd ..

echo "Building workout-app..."
cd workout-app && npm run build && cd ..

echo "Deploying to Firebase..."
firebase deploy --only hosting --project boostmind-b052c

echo "Done! URLs:"
echo "  https://boostmind-b052c.web.app/storyboard/"
echo "  https://boostmind-b052c.web.app/workout-app/"
