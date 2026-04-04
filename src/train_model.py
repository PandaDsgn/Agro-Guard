import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
import joblib

# Load dataset
df = pd.read_csv('C:\\Users\\DELL\\OneDrive\\ドキュメント\\GitHub\\Agro-Guard\\src\\Dataset_bettered (1).csv')

# Preprocessing: Convert 'Good'/'Bad' to 1/0
df['Class'] = df['Class'].str.strip().str.lower().map({'good': 1, 'bad': 0})
# Drop rows with missing classes if any
df = df.dropna(subset=['Class'])

# Feature selection
# We'll also encode the Fruit type as a number (Label Encoding)
df['Fruit_Code'] = df['Fruit'].astype('category').cat.codes
X = df[['Temp', 'Humid (%)', 'VPD', 'Fruit_Code']]
y = df['Class']

# 80-20 Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train Model
model = RandomForestClassifier(n_estimators=100)
model.fit(X_train, y_train)

# Save the model and the fruit mapping
joblib.dump(model, 'agro_guard_model.pkl')
fruit_mapping = dict(enumerate(df['Fruit'].astype('category').cat.categories))
joblib.dump(fruit_mapping, 'fruit_mapping.pkl')

print("Model trained and saved successfully!")