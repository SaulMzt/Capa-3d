const maintenanceDefaults = {
  enabled: false,
  badge: "Mantenimiento programado",
  title: "Volvemos muy pronto",
  highlight: "pronto",
  description: "Estamos realizando mejoras en Codexify para ofrecerte una experiencia mas rapida, segura y estable.",
  etaTitle: "Tiempo estimado",
  etaText: "Esperamos volver en 2 a 4 horas.",
  contactTitle: "Contacto",
  contactText: "Si necesitas ayuda urgente, escribe al administrador.",
  contactEmail: "soporte@codexify.com",
  updateTitle: "Estado",
  updateText: "El equipo esta trabajando en la actualizacion.",
  metricOneValue: "24/7",
  metricOneLabel: "Monitoreo",
  metricTwoValue: "99%",
  metricTwoLabel: "Avance",
  metricThreeValue: "2-4h",
  metricThreeLabel: "Estimado"
};

const setText = (id, value) => {
  const element = document.getElementById(id);
  if (element) element.textContent = value || "";
};

const renderMaintenance = (maintenance) => {
  const data = { ...maintenanceDefaults, ...maintenance };
  const title = data.title || maintenanceDefaults.title;
  const highlight = data.highlight || maintenanceDefaults.highlight;
  const titleElement = document.getElementById("maintenance-title");

  if (titleElement) {
    const index = title.toLowerCase().lastIndexOf(highlight.toLowerCase());
    if (highlight && index >= 0) {
      titleElement.textContent = "";
      titleElement.append(document.createTextNode(title.slice(0, index)));
      const span = document.createElement("span");
      span.textContent = title.slice(index, index + highlight.length);
      titleElement.append(span, document.createTextNode(title.slice(index + highlight.length)));
    } else {
      titleElement.textContent = title;
    }
  }

  setText("maintenance-badge", data.badge);
  setText("maintenance-description", data.description);
  setText("metric-one-value", data.metricOneValue);
  setText("metric-one-label", data.metricOneLabel);
  setText("metric-two-value", data.metricTwoValue);
  setText("metric-two-label", data.metricTwoLabel);
  setText("metric-three-value", data.metricThreeValue);
  setText("metric-three-label", data.metricThreeLabel);
  setText("eta-title", data.etaTitle);
  setText("eta-text", data.etaText);
  setText("contact-title", data.contactTitle);
  setText("contact-text", data.contactText);
  setText("update-title", data.updateTitle);
  setText("update-text", data.updateText);

  const email = document.getElementById("contact-email");
  if (email) {
    email.textContent = data.contactEmail;
    email.href = `mailto:${data.contactEmail}`;
  }
};

fetch("api.php?action=maintenance_state", { cache: "no-store", credentials: "same-origin" })
  .then((response) => response.ok ? response.json() : Promise.reject())
  .then((data) => {
    renderMaintenance(data.maintenance || maintenanceDefaults);
  })
  .catch(() => {
    renderMaintenance(maintenanceDefaults);
  });
