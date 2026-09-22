/* eslint-disable  @typescript-eslint/no-explicit-any */

// Helper function to apply inline decorations (bold, italic, links)
function applyDecorations(
  text: string,
  decorations: any[] | undefined
): string {
  if (!decorations || decorations.length === 0) {
    return text;
  }

  decorations.sort((a, b) => a.from - b.from);

  let resultHtml = "";
  let lastIndex = 0;

  decorations.forEach((decoration) => {
    resultHtml += text.substring(lastIndex, decoration.from);

    const decoratedSegment = text.substring(decoration.from, decoration.to);

    switch (decoration.type) {
      case "strong":
        resultHtml += `<strong>${decoratedSegment}</strong>`;
        break;
      case "em":
        resultHtml += `<em>${decoratedSegment}</em>`;
        break;
      case "link":
        const url =
          decoration.data && decoration.data.url ? decoration.data.url : "#";
        resultHtml += `<a href="${url}" target="_blank" rel="noopener noreferrer">${decoratedSegment}</a>`;
        break;
      default:
        console.warn(`Unknown decoration type: ${decoration.type}`, decoration);
        resultHtml += decoratedSegment;
        break;
    }

    lastIndex = decoration.to;
  });

  resultHtml += text.substring(lastIndex);

  return resultHtml;
}

export default applyDecorations;
