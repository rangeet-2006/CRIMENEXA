from sklearn.ensemble import IsolationForest
import numpy as np


class AnomalyModel:
    def __init__(self, contamination: float = 0.1):
        self.model = IsolationForest(contamination=contamination, random_state=42)
        self.is_fitted = False

    def fit(self, feature_matrix: list):
        X = np.array(feature_matrix)
        self.model.fit(X)
        self.is_fitted = True

    def predict(self, feature_matrix: list):
        if not self.is_fitted:
            raise RuntimeError("AnomalyModel must be fitted before calling predict")
        X = np.array(feature_matrix)
        predictions = self.model.predict(X)
        scores = self.model.decision_function(X)
        return predictions, scores