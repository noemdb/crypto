import {
  Html as EmailHtml,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Section,
  Row,
  Column,
  Text,
  Hr,
  Button,
} from "@react-email/components";
import type { OpportunityOutput } from "@/lib/schemas";

type Props = {
  opportunity: OpportunityOutput;
  appUrl: string;
};

export function OpportunityAlertEmail({ opportunity, appUrl }: Props) {
  const classColor =
    opportunity.classification === "EXECUTABLE" ? "#16a34a" : "#d97706";

  return (
    <EmailHtml>
      <Head />
      <Preview>
        ⚡ {opportunity.route} → ROI {opportunity.roiAdjusted.toFixed(2)}%
      </Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif" }}>
        <Container
          style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px" }}
        >
          <Heading style={{ fontSize: 20, color: "#111827" }}>
            Oportunidad Detectada
          </Heading>

          <Section
            style={{
              backgroundColor: "#fff",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              padding: "16px 20px",
              marginBottom: 16,
            }}
          >
            <Row>
              <Column style={{ color: "#6b7280", fontSize: 13 }}>Ruta</Column>
              <Column style={{ fontWeight: 600, textAlign: "right" }}>
                {opportunity.route}
              </Column>
            </Row>
            <Hr style={{ borderColor: "#f3f4f6", margin: "10px 0" }} />
            <Row>
              <Column style={{ color: "#6b7280", fontSize: 13 }}>
                Clasificación
              </Column>
              <Column
                style={{
                  color: classColor,
                  fontWeight: 700,
                  textAlign: "right",
                }}
              >
                {opportunity.classification}
              </Column>
            </Row>
            <Hr style={{ borderColor: "#f3f4f6", margin: "10px 0" }} />
            <Row>
              <Column style={{ color: "#6b7280", fontSize: 13 }}>
                ROI Ajustado
              </Column>
              <Column
                style={{
                  color: "#16a34a",
                  fontWeight: 700,
                  textAlign: "right",
                  fontSize: 18,
                }}
              >
                {opportunity.roiAdjusted.toFixed(2)}%
              </Column>
            </Row>
            <Hr style={{ borderColor: "#f3f4f6", margin: "10px 0" }} />
            <Row>
              <Column style={{ color: "#6b7280", fontSize: 13 }}>
                Fill Probability
              </Column>
              <Column style={{ textAlign: "right" }}>
                {(opportunity.fillProbability * 100).toFixed(0)}%
              </Column>
            </Row>
          </Section>

          <Section
            style={{
              backgroundColor: "#f9fafb",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              padding: "14px 20px",
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
              Desglose ROI:
            </Text>
            <Text style={{ fontSize: 13, margin: "2px 0" }}>
              Bruto: <strong>{opportunity.roiGross.toFixed(3)}%</strong>
            </Text>
            <Text style={{ fontSize: 13, margin: "2px 0", color: "#dc2626" }}>
              − Fees: {opportunity.feesImpact.toFixed(3)}%
            </Text>
            <Text style={{ fontSize: 13, margin: "2px 0", color: "#dc2626" }}>
              − Slippage: {opportunity.slippageImpact.toFixed(3)}%
            </Text>
            <Text style={{ fontSize: 13, margin: "2px 0", color: "#dc2626" }}>
              − Red: {opportunity.networkImpact.toFixed(3)}%
            </Text>
            <Hr style={{ borderColor: "#e5e7eb", margin: "8px 0" }} />
            <Text
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#16a34a",
                margin: 0,
              }}
            >
              = Ajustado: {opportunity.roiAdjusted.toFixed(2)}%
            </Text>
          </Section>

          <Button
            href={`${appUrl}/dashboard`}
            style={{
              backgroundColor: "#2563eb",
              color: "#fff",
              borderRadius: 6,
              padding: "10px 20px",
              fontSize: 14,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Ver en Dashboard →
          </Button>

          <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 24 }}>
            Evaluado:{" "}
            {new Date(opportunity.evaluatedAt).toLocaleString("es-VE")}.
            Antigüedad — buy: {opportunity.snapshotAge.buyMs}ms, sell:{" "}
            {opportunity.snapshotAge.sellMs}ms. Este email fue generado
            automáticamente por AIM.
          </Text>
        </Container>
      </Body>
    </EmailHtml>
  );
}
