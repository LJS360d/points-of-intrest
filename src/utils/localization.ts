export async function getClientWorldRegion() {
	try {
		const response = await fetch("https://ipapi.co/continent_code");
		if (response.ok) {
			const continentCode = await response.text();
			return continentCode;
		}
		console.error("Failed to fetch continent code");
		return null;
	} catch (error) {
		console.error("Error fetching continent code:", error);
		return null;
	}
}
