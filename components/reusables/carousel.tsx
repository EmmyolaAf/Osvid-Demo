import React, { ReactNode } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { EmblaOptionsType, EmblaPluginType } from "embla-carousel";

interface Props {
  children: ReactNode;
  options?: EmblaOptionsType;
  plugins?: EmblaPluginType[];
}

const EmblaCarousel = ({ children, options, plugins }: Props) => {
  const [emblaRef] = useEmblaCarousel(options, plugins);

  return (
    <main className="embla" ref={emblaRef}>
      <aside className="embla__container space-x-3">{children}</aside>
    </main>
  );
};

export default EmblaCarousel;
